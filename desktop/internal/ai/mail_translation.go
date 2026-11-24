package ai

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/profilemgr"
)

type TranslateMailRequest struct {
	ProfileID        string `json:"profileId"`
	MailID           string `json:"mailId"`
	RequestID        string `json:"requestId"`
	Provider         string `json:"provider,omitempty"`
	Source           string `json:"source"`
	Target           string `json:"target"`
	IncludeSubject   bool   `json:"includeSubject"`
	ConsentConfirmed bool   `json:"consentConfirmed"`
}

type MailTranslation struct {
	ProfileID        string            `json:"profileId"`
	MailID           string            `json:"mailId"`
	RequestID        string            `json:"requestId"`
	Source           string            `json:"source"`
	Target           string            `json:"target"`
	Subject          string            `json:"subject"`
	Segments         map[string]string `json:"segments"`
	CompletedBatches int               `json:"completedBatches"`
	TotalBatches     int               `json:"totalBatches"`
	FailureMessage   string            `json:"failureMessage,omitempty"`
}

var translationRequestID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

var translationLanguages = map[string]string{
	"zh-CN": "简体中文", "zh-TW": "繁体中文", "en": "英语", "ja": "日语", "ko": "韩语",
	"fr": "法语", "de": "德语", "es": "西班牙语", "pt": "葡萄牙语", "ru": "俄语",
	"it": "意大利语", "ar": "阿拉伯语",
}

func (g *Gateway) TranslateMail(callCtx context.Context, sess *profilemgr.Session, req TranslateMailRequest) (MailTranslation, error) {
	if req.ProfileID != sess.Meta.ID {
		return MailTranslation{}, apperr.New(apperr.CodeInvalidInput, "工作空间已切换，请重新选择邮件")
	}
	if !translationRequestID.MatchString(req.RequestID) {
		return MailTranslation{}, apperr.New(apperr.CodeInvalidInput, "翻译请求 ID 无效")
	}
	req.MailID = strings.TrimSpace(req.MailID)
	if req.MailID == "" || len(req.MailID) > 512 || translationLanguages[req.Target] == "" ||
		(req.Source != "auto" && translationLanguages[req.Source] == "") || req.Source == req.Target {
		return MailTranslation{}, apperr.New(apperr.CodeInvalidInput, "邮件或翻译语言无效，请检查源语言和目标语言")
	}
	if !req.ConsentConfirmed {
		return MailTranslation{}, apperr.New(apperr.CodeAiConsentRequired, "请确认允许向配置的翻译引擎发送邮件文字")
	}
	settings := config.LoadProfileSettings(sess.ProfileDir)
	if req.Provider != "" && req.Provider != settings.TranslationProvider {
		return MailTranslation{}, apperr.New(apperr.CodeInvalidInput, "翻译引擎已切换，请重新确认")
	}
	engine, err := mailTranslationEngine(sess, settings)
	if err != nil {
		return MailTranslation{}, err
	}
	ctx, cancel := context.WithTimeout(sess.Ctx, 120*time.Second)
	stop := context.AfterFunc(callCtx, cancel)
	defer stop()
	defer cancel()
	if err := callCtx.Err(); err != nil {
		return MailTranslation{}, err
	}
	var folder, subject, text, markup, snippet, securityJSON string
	var blocked bool
	err = sess.DB.QueryRowContext(ctx, `SELECT folder, subject, body_text, body_html_sanitized, snippet, security_json, ai_blocked
		FROM messages WHERE id = ?`, req.MailID).Scan(&folder, &subject, &text, &markup, &snippet, &securityJSON, &blocked)
	if err != nil {
		return MailTranslation{}, apperr.New(apperr.CodeNotFound, "未找到要翻译的邮件")
	}
	sensitiveErr := apperr.New(apperr.CodeAiSensitiveBlocked, "已在本地拦截敏感邮件，不向翻译引擎发送")
	if IsSensitiveMail(folder, subject, text, securityJSON, blocked) || hasSensitiveMailText(snippet) || hasSensitiveMailText(markup) {
		return MailTranslation{}, sensitiveErr
	}
	segments, err := mailTranslationSegments(markup, text)
	if err != nil {
		return MailTranslation{}, err
	}
	if hasSensitiveMailText(strings.Join(segments, " ")) {
		return MailTranslation{}, sensitiveErr
	}
	subject = strings.TrimSpace(subject)
	hasSubject := req.IncludeSubject && canTranslateText(subject)
	if hasSubject {
		withSubject := []string{subject}
		for _, segment := range segments {
			if segment != subject {
				withSubject = append(withSubject, segment)
			}
		}
		segments = withSubject
	}
	if len(segments) == 0 {
		return MailTranslation{}, apperr.New(apperr.CodeInvalidInput, "此邮件没有可翻译的正文文字")
	}
	batches, err := batchTranslationSegmentsForProvider(segments, settings.TranslationProvider)
	if err != nil {
		return MailTranslation{}, err
	}
	result := MailTranslation{
		ProfileID: req.ProfileID, MailID: req.MailID, RequestID: req.RequestID,
		Source: req.Source, Target: req.Target, Segments: make(map[string]string), TotalBatches: len(batches),
	}
	for _, batch := range batches {
		src, translated, err := engine(ctx, req.Source, req.Target, batch)
		if err != nil {
			// Wails 出错时只传错误对象；已完成的内容必须随终态快照返回，不能仅依赖事件。
			if result.CompletedBatches > 0 {
				var failure *apperr.AppError
				if errors.As(err, &failure) && failure.Code == apperr.CodeTranslationFailed {
					result.FailureMessage = failure.Message
				}
				return result, nil
			}
			return MailTranslation{}, err
		}
		if result.Source == "auto" && translationLanguages[src] != "" {
			result.Source = src
		}
		delta := make(map[string]string, len(batch))
		for i, original := range batch {
			result.Segments[original] = translated[i]
			delta[original] = translated[i]
		}
		result.CompletedBatches++
		subjectDelta := ""
		if hasSubject && result.CompletedBatches == 1 {
			subjectDelta = translated[0]
			result.Subject = subjectDelta
		}
		if g.bus != nil && ctx.Err() == nil {
			g.bus.Emit(events.MailTranslationBatch, events.MailTranslationBatchPayload{
				MailTranslationRequestKey: events.MailTranslationRequestKey{
					ProfileID: req.ProfileID, MailID: req.MailID, RequestID: req.RequestID,
				},
				Source: result.Source, Subject: subjectDelta, Segments: delta,
				CompletedBatches: result.CompletedBatches, TotalBatches: result.TotalBatches,
			})
		}
	}
	return result, nil
}

func canTranslateText(text string) bool {
	if !strings.ContainsAny(text, " \t\r\n") &&
		(strings.Contains(text, "@") || strings.Contains(text, "://") || strings.HasPrefix(text, "www.")) {
		return false
	}
	return strings.ContainsFunc(text, unicode.IsLetter)
}
