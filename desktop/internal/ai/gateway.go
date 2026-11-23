package ai

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"omnimail/internal/apperr"
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

func (g *Gateway) AskMailStream(sess *profilemgr.Session, req AskMailRequest) (string, error) {
	req, err := normalizeMailAskRequest(req)
	if err != nil {
		return "", err
	}
	reqID := req.RequestID
	settings := config.LoadProfileSettings(sess.ProfileDir)
	mailCtx, err := PrepareMailContext(sess.DB, settings, req.MailID, req.ConsentConfirmed)
	if err != nil {
		return "", err
	}
	pCfg := resolveProviderConfig(sess, settings)
	includesSubject := settings.AiIncludeSenderAndAttachments
	history, err := loadChatHistory(sess.DB, req.MailID, includesSubject)
	if err != nil {
		return "", errors.New("无法读取本地 AI 对话")
	}
	msgs := buildAskMessages(mailCtx, history, req.Question, !strings.EqualFold(settings.AiProvider, "ollama"), mailUILanguage(settings.Language))
	ctx, cancel := context.WithTimeout(sess.Ctx, 90*time.Second)
	if !g.registerCancel(reqID, cancel) {
		cancel()
		return "", apperr.New(apperr.CodeInvalidInput, "AI 请求已在处理中")
	}

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
		if strings.TrimSpace(full) == "" {
			g.emitAiError(reqID, req.MailID, errors.New("模型未返回文本内容"))
			return
		}
		if err := appendChatTurnsToDB(ctx, sess.DB, req.MailID, pCfg.Model, reqID, req.Question, full, includesSubject); err != nil {
			if !errors.Is(err, context.Canceled) {
				g.emitAiError(reqID, req.MailID, errors.New("无法在本地保存 AI 对话"))
			}
			return
		}
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
	if !g.registerCancel(reqID, cancel) {
		cancel()
		return "", apperr.New(apperr.CodeInvalidInput, "AI 请求已在处理中")
	}

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

func (g *Gateway) registerCancel(reqID string, cancel context.CancelFunc) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	if _, exists := g.cancels[reqID]; exists {
		return false
	}
	g.cancels[reqID] = cancel
	return true
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
