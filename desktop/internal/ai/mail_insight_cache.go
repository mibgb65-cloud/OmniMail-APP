package ai

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"
)

func saveMailInsight(ctx context.Context, db *sql.DB, mailID, model, source string, fields map[string]any, isSummary bool) (AiMailInsight, error) {
	saveErr := errors.New("无法在本地保存 AI 结果")
	if source != "" {
		fields["sourceLanguage"] = source
	}
	patch, err := json.Marshal(fields)
	if err != nil {
		return AiMailInsight{}, saveErr
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return AiMailInsight{}, saveErr
	}
	defer tx.Rollback()
	var raw string
	// 在 SQLite 写入语句内合并本次负责的字段，避免并发的摘要、拟稿或聊天互相覆盖。
	err = tx.QueryRowContext(ctx, `
		INSERT INTO ai_insights(message_id, model_name, insight_json, chat_turns_json, updated_at)
		VALUES (?, ?, ?, '[]', ?)
		ON CONFLICT(message_id) DO UPDATE SET model_name=excluded.model_name, insight_json=json_patch(
			CASE WHEN json_valid(ai_insights.insight_json) THEN ai_insights.insight_json ELSE '{}' END,
			excluded.insight_json
		), updated_at=excluded.updated_at
		RETURNING insight_json
	`, mailID, model, string(patch), time.Now().UnixMilli()).Scan(&raw)
	var ins AiMailInsight
	if err != nil || json.Unmarshal([]byte(raw), &ins) != nil {
		return AiMailInsight{}, saveErr
	}
	if isSummary {
		if _, err := tx.ExecContext(ctx, `UPDATE messages SET ai_summarized = 1 WHERE id = ?`, mailID); err != nil {
			return AiMailInsight{}, saveErr
		}
	}
	if err := tx.Commit(); err != nil {
		return AiMailInsight{}, saveErr
	}
	ins.ModelName, ins.Cached = model, false
	if ins.Deadlines == nil {
		ins.Deadlines = []AiDeadlineItem{}
	}
	return ins, nil
}
