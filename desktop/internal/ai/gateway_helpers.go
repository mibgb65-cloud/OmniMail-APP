package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

func resolveProviderConfig(sess *profilemgr.Session, settings config.AppSettings) ProviderConfig {
	prov, base, err := config.ResolveAiEndpoint(settings.AiProvider, settings.AiBaseURL)
	var key string
	if err == nil && sess != nil && sess.Vault != nil {
		key, _ = sess.Vault.Get(config.AiVaultKey(prov, base))
	} else if err != nil {
		// 保留原值，让请求入口返回校验错误，而不是静默退回 OpenAI。
		prov, base = settings.AiProvider, settings.AiBaseURL
	}
	return ProviderConfig{
		Provider: prov,
		Model:    settings.AiModel,
		BaseURL:  base,
		APIKey:   key,
	}
}

func parseInsightFromRaw(raw string) AiMailInsight {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(strings.TrimSpace(cleaned), "```")
	if start, end := strings.IndexByte(cleaned, '{'), strings.LastIndexByte(cleaned, '}'); start >= 0 && end > start {
		cleaned = cleaned[start : end+1]
	}
	var ins AiMailInsight
	if json.Unmarshal([]byte(cleaned), &ins) == nil && ins.Summary != "" {
		if ins.Deadlines == nil {
			ins.Deadlines = []AiDeadlineItem{}
		}
		if ins.DraftTag == "" {
			ins.DraftTag = "建议回复"
		}
		return ins
	}
	return AiMailInsight{
		SummaryTitle: "邮件要点摘要",
		Summary:      truncateRunes(strings.TrimSpace(raw), 400),
		Deadlines:    []AiDeadlineItem{},
		DraftTag:     "建议回复",
		DraftReply:   "已收到您的邮件，我会尽快处理并反馈。",
	}
}

func buildAskMessages(mailCtx string, history []AiChatTurn, question string) []ChatMessage {
	msgs := []ChatMessage{
		{
			Role:    "system",
			Content: "你是本地邮件客户端 OmniMail 的辅助助手。请严格基于下方提供的邮件上下文简明准确地回答用户提问。\n\n[邮件上下文]\n" + mailCtx,
		},
	}
	start := 0
	if len(history) > 6 {
		start = len(history) - 6
	}
	for _, h := range history[start:] {
		if (h.Role == "user" || h.Role == "assistant") && strings.TrimSpace(h.Content) != "" {
			msgs = append(msgs, ChatMessage{Role: h.Role, Content: h.Content})
		}
	}
	msgs = append(msgs, ChatMessage{Role: "user", Content: strings.TrimSpace(question)})
	return msgs
}

func buildComposeAssistMessages(action, tone, content string) []ChatMessage {
	toneMap := map[string]string{
		"professional": "专业正式、商务得体",
		"concise":      "精炼简洁、直奔主题",
		"friendly":     "温和友好、自然礼貌",
	}
	toneDesc := toneMap[strings.ToLower(tone)]
	if toneDesc == "" {
		toneDesc = "专业礼貌"
	}
	instruction := "请将用户输入润色并生成一封可直接粘贴到邮件正文中的内容，不输出多余寒暄解释。"
	switch strings.ToLower(action) {
	case "translate_en":
		instruction = "请将下方邮件草稿准确翻译为地道商务英文，仅输出译文正文。"
	case "translate_zh":
		instruction = "请将下方邮件草稿准确翻译为自然流畅的简体中文，仅输出译文正文。"
	case "polish":
		instruction = fmt.Sprintf("请按「%s」语气润色下方草稿，仅输出润色后的邮件正文。", toneDesc)
	default:
		instruction = fmt.Sprintf("请按「%s」语气起草一封邮件正文，仅输出正文内容。", toneDesc)
	}
	return []ChatMessage{
		{Role: "system", Content: instruction},
		{Role: "user", Content: content},
	}
}

func appendChatTurnsToDB(db *sql.DB, mailID, model, question, answer string) {
	now := time.Now()
	ts := now.Format("15:04")
	var turnsJ string
	_ = db.QueryRow(`SELECT chat_turns_json FROM ai_insights WHERE message_id = ?`, mailID).Scan(&turnsJ)
	var turns []AiChatTurn
	_ = json.Unmarshal([]byte(turnsJ), &turns)
	turns = append(turns,
		AiChatTurn{ID: fmt.Sprintf("t-u-%d", now.UnixMilli()), Role: "user", Content: question, Timestamp: ts},
		AiChatTurn{ID: fmt.Sprintf("t-a-%d", now.UnixMilli()+1), Role: "assistant", Content: answer, Timestamp: ts},
	)
	if len(turns) > 20 {
		turns = turns[len(turns)-20:]
	}
	nextJ, _ := json.Marshal(turns)
	_, _ = db.Exec(`
		INSERT INTO ai_insights(message_id, model_name, insight_json, chat_turns_json, updated_at)
		VALUES (?, ?, '{}', ?, ?)
		ON CONFLICT(message_id) DO UPDATE SET chat_turns_json=excluded.chat_turns_json, updated_at=excluded.updated_at
	`, mailID, model, string(nextJ), now.UnixMilli())
}
