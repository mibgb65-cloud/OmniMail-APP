package ai

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
)

type Gateway struct {
	mu      sync.Mutex
	bus     *events.Bus
	cancels map[string]context.CancelFunc
}

func NewGateway(bus *events.Bus) *Gateway {
	return &Gateway{
		bus:     bus,
		cancels: make(map[string]context.CancelFunc),
	}
}

func (g *Gateway) CancelRequest(requestID string) {
	g.mu.Lock()
	cancel := g.cancels[requestID]
	delete(g.cancels, requestID)
	g.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

func (g *Gateway) GetCachedInsight(db *sql.DB, mailID string) (*AiMailInsight, []AiChatTurn) {
	var modelName, insightJ, turnsJ string
	err := db.QueryRow(`SELECT model_name, insight_json, chat_turns_json FROM ai_insights WHERE message_id = ?`,
		strings.TrimSpace(mailID)).Scan(&modelName, &insightJ, &turnsJ)
	if err != nil {
		return nil, nil
	}
	var ins AiMailInsight
	if json.Unmarshal([]byte(insightJ), &ins) != nil {
		return nil, nil
	}
	ins.Cached = true
	ins.ModelName = modelName
	if ins.Deadlines == nil {
		ins.Deadlines = []AiDeadlineItem{}
	}
	var turns []AiChatTurn
	_ = json.Unmarshal([]byte(turnsJ), &turns)
	return &ins, turns
}

func (g *Gateway) AnalyzeMail(sess *profilemgr.Session, mailID string, consentConfirmed, forceRefresh bool) (AiMailInsight, error) {
	if !forceRefresh {
		if cached, _ := g.GetCachedInsight(sess.DB, mailID); cached != nil {
			return *cached, nil
		}
	}
	settings := config.LoadProfileSettings(sess.ProfileDir)
	mailCtx, err := PrepareMailContext(sess.DB, settings, mailID, consentConfirmed)
	if err != nil {
		return AiMailInsight{}, err
	}
	pCfg := resolveProviderConfig(sess, settings)
	ctx, cancel := context.WithTimeout(sess.Ctx, 65*time.Second)
	defer cancel()

	raw, err := StreamChat(ctx, pCfg, []ChatMessage{
		{
			Role:    "system",
			Content: "你是严谨的本地邮件隐私助手。请仅输出合法 JSON 对象，字段必须为: summaryTitle (15字内主旨), summary (2~3句结构化摘要), deadlines (数组，每项含 label, timeText, urgent), draftTag (简短回复标签), draftReply (礼貌可直接发送的回复草稿)。不要输出 Markdown 代码块。",
		},
		{Role: "user", Content: mailCtx},
	}, nil)
	if err != nil {
		return AiMailInsight{}, err
	}

	ins := parseInsightFromRaw(raw)
	ins.ModelName = pCfg.Model
	insJ, _ := json.Marshal(ins)
	nowMs := time.Now().UnixMilli()
	_, _ = sess.DB.Exec(`
		INSERT INTO ai_insights(message_id, model_name, insight_json, chat_turns_json, updated_at)
		VALUES (?, ?, ?, '[]', ?)
		ON CONFLICT(message_id) DO UPDATE SET model_name=excluded.model_name, insight_json=excluded.insight_json, updated_at=excluded.updated_at
	`, mailID, pCfg.Model, string(insJ), nowMs)
	_, _ = sess.DB.Exec(`UPDATE messages SET ai_summarized = 1 WHERE id = ?`, mailID)
	return ins, nil
}

func (g *Gateway) AskMailStream(sess *profilemgr.Session, req AskMailRequest) (string, error) {
	settings := config.LoadProfileSettings(sess.ProfileDir)
	mailCtx, err := PrepareMailContext(sess.DB, settings, req.MailID, req.ConsentConfirmed)
	if err != nil {
		return "", err
	}
	pCfg := resolveProviderConfig(sess, settings)
	msgs := buildAskMessages(mailCtx, req.History, req.Question)
	reqID := newAiRequestID()
	ctx, cancel := context.WithTimeout(sess.Ctx, 90*time.Second)
	g.registerCancel(reqID, cancel)

	go func() {
		defer g.CancelRequest(reqID)
		full, sErr := StreamChat(ctx, pCfg, msgs, func(delta string) {
			if g.bus != nil {
				g.bus.Emit(events.AiChunk, events.AiChunkPayload{RequestID: reqID, MailID: req.MailID, Delta: delta})
			}
		})
		if sErr != nil {
			if errors.Is(sErr, context.Canceled) {
				return
			}
			g.emitAiError(reqID, req.MailID, sErr)
			return
		}
		appendChatTurnsToDB(sess.DB, req.MailID, pCfg.Model, req.Question, full)
		if g.bus != nil {
			g.bus.Emit(events.AiDone, events.AiDonePayload{RequestID: reqID, MailID: req.MailID, FullText: full})
		}
	}()
	return reqID, nil
}

func (g *Gateway) AssistComposeStream(sess *profilemgr.Session, req ComposeAssistRequest) (string, error) {
	settings := config.LoadProfileSettings(sess.ProfileDir)
	cleanText, err := PrepareComposeContext(settings, req.Subject+"\n"+req.Body+"\n"+req.Prompt, req.ConsentConfirmed)
	if err != nil {
		return "", err
	}
	pCfg := resolveProviderConfig(sess, settings)
	msgs := buildComposeAssistMessages(req.Action, req.Tone, cleanText)
	reqID := newAiRequestID()
	ctx, cancel := context.WithTimeout(sess.Ctx, 75*time.Second)
	g.registerCancel(reqID, cancel)

	go func() {
		defer g.CancelRequest(reqID)
		full, sErr := StreamChat(ctx, pCfg, msgs, func(delta string) {
			if g.bus != nil {
				g.bus.Emit(events.AiChunk, events.AiChunkPayload{RequestID: reqID, Delta: delta})
			}
		})
		if sErr != nil {
			if !errors.Is(sErr, context.Canceled) {
				g.emitAiError(reqID, "", sErr)
			}
			return
		}
		if g.bus != nil {
			g.bus.Emit(events.AiDone, events.AiDonePayload{RequestID: reqID, FullText: full})
		}
	}()
	return reqID, nil
}

func (g *Gateway) registerCancel(reqID string, cancel context.CancelFunc) {
	g.mu.Lock()
	g.cancels[reqID] = cancel
	g.mu.Unlock()
}

func (g *Gateway) emitAiError(reqID, mailID string, err error) {
	if g.bus == nil {
		return
	}
	st := "error"
	msg := security.RedactSensitive(err.Error())
	var pe *ProviderError
	if errors.As(err, &pe) {
		st = pe.RunStatus
		msg = pe.Message
	}
	g.bus.Emit(events.AiError, events.AiErrorPayload{RequestID: reqID, MailID: mailID, RunStatus: st, Message: msg})
}

func newAiRequestID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return fmt.Sprintf("aireq-%d-%s", time.Now().UnixMilli(), hex.EncodeToString(b))
}
