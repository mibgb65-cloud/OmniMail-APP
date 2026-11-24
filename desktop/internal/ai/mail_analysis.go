package ai

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

func mailUILanguage(locale string) string {
	if locale == "en-US" {
		return "en"
	}
	return "zh-CN"
}

func (g *Gateway) SummarizeMail(callCtx context.Context, sess *profilemgr.Session, mailID string, consentConfirmed, forceRefresh bool, options MailSummaryOptions) (AiMailInsight, error) {
	mailID = strings.TrimSpace(mailID)
	if options.AutoTriggered && forceRefresh {
		return AiMailInsight{}, apperr.New(apperr.CodeInvalidInput, "自动摘要不能强制刷新")
	}
	ctx, done, err := g.startMailRequest(callCtx, sess, mailID, options.RequestID, options.SourceLanguage)
	if err != nil {
		return AiMailInsight{}, err
	}
	defer done()

	settings := config.LoadProfileSettings(sess.ProfileDir)
	mail, err := loadGuardedMail(ctx, sess.DB, settings, mailID, options.AutoTriggered)
	if err != nil {
		return AiMailInsight{}, err
	}
	target := mailUILanguage(settings.Language)
	if !forceRefresh {
		cached, _, err := g.GetCachedInsight(ctx, sess.DB, mailID)
		if err != nil {
			return AiMailInsight{}, err
		}
		// 旧版未记录语言的摘要仍可复用，用户可通过手动刷新替换。
		if cached != nil && strings.TrimSpace(cached.Summary) != "" &&
			(cached.SummaryLanguage == target || cached.SummaryLanguage == "") {
			return *cached, nil
		}
	}
	mailCtx, err := mail.prepare(settings, consentConfirmed, options.AutoTriggered)
	if err != nil {
		return AiMailInsight{}, err
	}
	pCfg := resolveProviderConfig(sess, settings)
	var ins struct {
		SummaryTitle   string           `json:"summaryTitle"`
		Summary        string           `json:"summary"`
		Deadlines      []AiDeadlineItem `json:"deadlines"`
		SourceLanguage string           `json:"sourceLanguage"`
	}
	err = requestMailInsight(ctx, pCfg, mailSummaryPrompt(options.SourceLanguage, target), mailCtx, &ins)
	if err != nil {
		return AiMailInsight{}, err
	}
	if strings.TrimSpace(ins.Summary) == "" {
		return AiMailInsight{}, errors.New("模型未返回邮件摘要，请重试")
	}
	if ins.Deadlines == nil {
		ins.Deadlines = []AiDeadlineItem{}
	}
	patch := map[string]any{
		"summaryTitle": ins.SummaryTitle, "summary": ins.Summary,
		"deadlines": ins.Deadlines, "summaryLanguage": target,
	}
	return saveMailInsight(ctx, sess.DB, mailID, pCfg.Model, detectedSourceLanguage(options.SourceLanguage, ins.SourceLanguage), patch, true)
}

func (g *Gateway) GenerateReplyDraft(callCtx context.Context, sess *profilemgr.Session, mailID string, consentConfirmed bool, options MailDraftOptions) (AiMailInsight, error) {
	switch options.TargetLanguage {
	case "original", "zh-CN", "en":
	default:
		return AiMailInsight{}, apperr.New(apperr.CodeInvalidInput, "不支持的回复语言")
	}
	if options.Tone != "formal" && options.Tone != "friendly" {
		return AiMailInsight{}, apperr.New(apperr.CodeInvalidInput, "不支持的回复语气")
	}
	mailID = strings.TrimSpace(mailID)
	ctx, done, err := g.startMailRequest(callCtx, sess, mailID, options.RequestID, options.SourceLanguage)
	if err != nil {
		return AiMailInsight{}, err
	}
	defer done()

	settings := config.LoadProfileSettings(sess.ProfileDir)
	mailCtx, err := PrepareMailContext(ctx, sess.DB, settings, mailID, consentConfirmed, false)
	if err != nil {
		return AiMailInsight{}, err
	}
	pCfg := resolveProviderConfig(sess, settings)
	var ins struct {
		DraftReply     string `json:"draftReply"`
		DraftTag       string `json:"draftTag"`
		SourceLanguage string `json:"sourceLanguage"`
	}
	err = requestMailInsight(ctx, pCfg, mailDraftPrompt(options), mailCtx, &ins)
	if err != nil {
		return AiMailInsight{}, err
	}
	if strings.TrimSpace(ins.DraftReply) == "" {
		return AiMailInsight{}, errors.New("模型未返回回复草稿，请重试")
	}
	source := detectedSourceLanguage(options.SourceLanguage, ins.SourceLanguage)
	language := options.TargetLanguage
	if language == "original" {
		language = source
	}
	patch := map[string]any{
		"draftReply": ins.DraftReply, "draftTag": ins.DraftTag, "draftLanguage": language,
		"draftTargetLanguage": options.TargetLanguage, "draftTone": options.Tone,
	}
	return saveMailInsight(ctx, sess.DB, mailID, pCfg.Model, source, patch, false)
}

func (g *Gateway) startMailRequest(callCtx context.Context, sess *profilemgr.Session, mailID, reqID, source string) (context.Context, func(), error) {
	if mailID == "" || len(mailID) > 512 || !utf8.ValidString(mailID) ||
		(source != "" && source != "auto" && translationLanguages[source] == "") {
		return nil, nil, apperr.New(apperr.CodeInvalidInput, "邮件 ID 或原文语言无效")
	}
	if reqID == "" {
		reqID = newAiRequestID()
	} else if !mailRequestIDPattern.MatchString(reqID) {
		return nil, nil, apperr.New(apperr.CodeInvalidInput, "AI 请求 ID 无效")
	}
	ctx, cancel := context.WithTimeout(callCtx, 65*time.Second)
	// Wails 调用取消和本地空间退出都必须中断等待、网络请求及缓存写入。
	stop := context.AfterFunc(sess.Ctx, cancel)
	if sess.Ctx.Err() != nil {
		cancel()
	}
	if !g.registerCancel(reqID, cancel) {
		stop()
		cancel()
		return nil, nil, apperr.New(apperr.CodeInvalidInput, "AI 请求已在处理中")
	}
	return ctx, func() {
		stop()
		g.finishRequest(reqID)
	}, nil
}

func requestMailInsight(ctx context.Context, cfg ProviderConfig, prompt, mailCtx string, response any) error {
	raw, err := StreamChat(ctx, cfg, []ChatMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: mailCtx},
	}, nil)
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if err != nil {
		return err
	}
	raw = strings.TrimSpace(raw)
	if strings.HasPrefix(raw, "```") {
		raw = strings.TrimPrefix(raw, "```")
		raw = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(raw, "json"), "```"))
	}
	if json.Unmarshal([]byte(raw), response) != nil {
		return errors.New("模型未返回有效的 JSON，请重试")
	}
	return nil
}

func detectedSourceLanguage(hint, detected string) string {
	if translationLanguages[hint] != "" {
		return hint
	}
	if translationLanguages[detected] != "" {
		return detected
	}
	return ""
}
