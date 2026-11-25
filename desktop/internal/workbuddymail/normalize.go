package workbuddymail

import (
	"encoding/json"
	"html"
	"regexp"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

var htmlTagPattern = regexp.MustCompile(`<[^>]+>`)

type rawErrorEnvelope struct {
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details struct {
			ConfirmationToken string `json:"confirmation_token"`
		} `json:"details"`
	} `json:"error"`
}

func shouldRefreshToken(status int, body []byte) bool {
	if status == 401 {
		return true
	}
	var env rawErrorEnvelope
	return json.Unmarshal(body, &env) == nil && env.Error != nil && env.Error.Code == "AUTHENTICATION_REQUIRED"
}

func mapRestError(status int, body []byte) error {
	var env rawErrorEnvelope
	var errMsg string
	if json.Unmarshal(body, &env) == nil && env.Error != nil {
		errMsg = sanitizeServerMessage(env.Error.Message)
		if env.Error.Code != "" {
			switch env.Error.Code {
			case "AUTHENTICATION_REQUIRED":
				return apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 登录状态已失效，请重新授权")
			case "ACCOUNT_SUSPENDED", "ALIAS_ACCESS_DENIED", "INSUFFICIENT_SCOPE", "REAL_NAME_RESTRICTED":
				return apperr.New(apperr.CodeWBSuspended, firstNonEmpty(errMsg, "当前智能体邮箱账号受限或已被冻结"))
			case "DAILY_QUOTA_EXCEEDED":
				return apperr.New(apperr.CodeWBQuotaExceeded, "今日智能体邮箱操作额度已用完")
			case "RATE_LIMIT_EXCEEDED":
				return apperr.New(apperr.CodeWBRateLimited, "操作过于频繁，请稍后再试")
			case "NOT_FOUND":
				return apperr.New(apperr.CodeNotFound, firstNonEmpty(errMsg, "邮件或附件不存在"))
			default:
				return apperr.New(apperr.CodeWBGatewayFailed, firstNonEmpty(errMsg, "智能体邮箱服务请求失败，请稍后重试"))
			}
		}
	}
	_, envMsg, _ := unwrapEnvelope(body)
	fallbackMsg := firstNonEmpty(errMsg, sanitizeServerMessage(envMsg))
	switch {
	case status == 401 || status == 403:
		return apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 登录状态已失效，请重新授权")
	case status == 404:
		return apperr.New(apperr.CodeNotFound, firstNonEmpty(fallbackMsg, "邮件或附件不存在"))
	case status == 429:
		return apperr.New(apperr.CodeWBRateLimited, "请求过于频繁，请稍后再试")
	case status >= 400:
		return apperr.New(apperr.CodeWBGatewayFailed, firstNonEmpty(fallbackMsg, "智能体邮箱网关返回异常状态"))
	default:
		return nil
	}
}

func NormalizeMailboxStatus(raw string) MailboxServiceStatus {
	s := strings.ToLower(strings.TrimSpace(raw))
	switch MailboxServiceStatus(s) {
	case StatusRunning, "active":
		return StatusRunning
	case StatusNotBound, StatusDeactivated, StatusSuspended, StatusBanned, StatusDeleted, StatusRevoked, StatusAuthFailed:
		return MailboxServiceStatus(s)
	case "forbidden":
		return StatusBanned
	default:
		return StatusNotBound
	}
}

func NormalizeMessageDetail(raw rawMessageDetail, quota DailyQuota) MessageDetailDTO {
	format := strings.ToUpper(strings.TrimSpace(raw.BodyFormat))
	var sanitizedHTML, plainText string
	var hasRemote bool
	if format == "HTML" {
		sanitizedHTML, hasRemote = security.SanitizeMailHTML(raw.Body, nil)
		plainText = strings.TrimSpace(strings.Join(strings.Fields(html.UnescapeString(htmlTagPattern.ReplaceAllString(sanitizedHTML, " "))), " "))
	} else {
		format = "TEXT"
		plainText = raw.Body
	}
	atts := make([]AttachmentMetaDTO, 0, len(raw.Attachments))
	for _, a := range raw.Attachments {
		if id := strings.TrimSpace(a.AttachmentID); id != "" {
			atts = append(atts, AttachmentMetaDTO{
				AttachmentID: id,
				Filename:     mailproto.SanitizeFilename(a.Filename),
				Size:         a.Size,
				ContentType:  strings.TrimSpace(a.ContentType),
			})
		}
	}
	return MessageDetailDTO{
		MessageID:       strings.TrimSpace(raw.MessageID),
		Subject:         strings.TrimSpace(raw.Subject),
		From:            parseSingleAddress(raw.From),
		To:              parseAddressList(raw.To),
		Cc:              parseAddressList(raw.Cc),
		CreatedAt:       parseTimestamp(raw.CreatedAt),
		IsRead:          raw.IsRead,
		BodyFormat:      format,
		SanitizedHTML:   sanitizedHTML,
		PlainText:       plainText,
		HasRemoteImages: hasRemote,
		Attachments:     atts,
		DailyQuota:      quota,
	}
}
