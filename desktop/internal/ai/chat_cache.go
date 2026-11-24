package ai

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

func (g *Gateway) ReadMailInsight(ctx context.Context, sess *profilemgr.Session, mailID string) (*AiMailInsight, []AiChatTurn, error) {
	mailID = strings.TrimSpace(mailID)
	if mailID == "" || len(mailID) > 512 {
		return nil, nil, apperr.New(apperr.CodeInvalidInput, "邮件 ID 无效")
	}
	// 缓存只读不外发，无需确认，但不应展示后来被标记为禁读的邮件结果。
	if _, err := loadGuardedMail(ctx, sess.DB, config.LoadProfileSettings(sess.ProfileDir), mailID, false); err != nil {
		return nil, nil, err
	}
	return g.GetCachedInsight(ctx, sess.DB, mailID)
}

func (g *Gateway) GetCachedInsight(ctx context.Context, db *sql.DB, mailID string) (*AiMailInsight, []AiChatTurn, error) {
	var modelName, insightJ, turnsJ string
	err := db.QueryRowContext(ctx, `SELECT model_name, insight_json, chat_turns_json FROM ai_insights WHERE message_id = ?`,
		strings.TrimSpace(mailID)).Scan(&modelName, &insightJ, &turnsJ)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, errors.New("无法读取本地 AI 缓存")
	}
	var turns []AiChatTurn
	_ = json.Unmarshal([]byte(turnsJ), &turns)
	var ins AiMailInsight
	// 只有聊天记录的行使用 {} 占位，不能误判为已生成过摘要。
	if json.Unmarshal([]byte(insightJ), &ins) != nil ||
		(ins.SummaryTitle == "" && ins.Summary == "" && ins.DraftReply == "" && len(ins.Deadlines) == 0) {
		return nil, turns, nil
	}
	ins.Cached = true
	ins.ModelName = modelName
	if ins.Deadlines == nil {
		ins.Deadlines = []AiDeadlineItem{}
	}
	return &ins, turns, nil
}

type storedChatTurn struct {
	AiChatTurn
	IncludesSubject *bool `json:"includesSubject,omitempty"`
}

func loadChatHistory(db *sql.DB, mailID string, includesSubject bool) ([]AiChatTurn, error) {
	var raw string
	err := db.QueryRow(`SELECT chat_turns_json FROM ai_insights WHERE message_id = ?`, mailID).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var turns []storedChatTurn
	if err := json.Unmarshal([]byte(raw), &turns); err != nil {
		return nil, err
	}
	// 旧版可能包含附件预览；不同范围的旧问答也可能引用主题。均只保留在本地展示。
	var history []AiChatTurn
	for _, turn := range turns {
		if turn.IncludesSubject != nil && *turn.IncludesSubject == includesSubject {
			history = append(history, turn.AiChatTurn)
		}
	}
	return history, nil
}

func appendChatTurnsToDB(ctx context.Context, db *sql.DB, mailID, model, reqID, question, answer string, includesSubject bool) error {
	now := time.Now()
	ts := now.Format("15:04")
	turns := []storedChatTurn{
		{AiChatTurn: AiChatTurn{ID: reqID + "-user", Role: "user", Content: question, Timestamp: ts}, IncludesSubject: &includesSubject},
		{AiChatTurn: AiChatTurn{ID: reqID + "-assistant", Role: "assistant", Content: answer, Timestamp: ts}, IncludesSubject: &includesSubject},
	}
	raw, err := json.Marshal(turns)
	if err != nil {
		return err
	}
	// 单条 SQLite 更新原子地追加一整轮问答，并保留最近十轮；不覆盖摘要。
	_, err = db.ExecContext(ctx, `
		INSERT INTO ai_insights(message_id, model_name, insight_json, chat_turns_json, updated_at)
		VALUES (?, ?, '{}', ?, ?)
		ON CONFLICT(message_id) DO UPDATE SET chat_turns_json = json_insert(
			CASE WHEN json_array_length(ai_insights.chat_turns_json) >= 20
				THEN json_remove(ai_insights.chat_turns_json, '$[0]', '$[0]')
				ELSE ai_insights.chat_turns_json END,
			'$[#]', json_extract(excluded.chat_turns_json, '$[0]'),
			'$[#]', json_extract(excluded.chat_turns_json, '$[1]')
		), updated_at=excluded.updated_at
	`, mailID, model, string(raw), now.UnixMilli())
	return err
}
