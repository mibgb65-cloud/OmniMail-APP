package workbuddymail

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
)

func (c *Client) GetMessageDetail(ctx context.Context, aliasID, messageID string) (MessageDetailDTO, error) {
	aid, mid := strings.TrimSpace(aliasID), strings.TrimSpace(messageID)
	if aid == "" || mid == "" {
		return MessageDetailDTO{}, apperr.New(apperr.CodeInvalidInput, "缺少邮件标识参数")
	}
	rel := "/console/agent-gateway/agentmailrest/v1/aliases/" + url.PathEscape(aid) + "/messages/" + url.PathEscape(mid)
	status, body, quota, err := c.doRequest(ctx, http.MethodGet, rel, nil, nil, MaxJSONResponseBytes)
	if err != nil {
		return MessageDetailDTO{}, err
	}
	if err := mapRestError(status, body); err != nil {
		return MessageDetailDTO{}, err
	}
	_, _, payload := unwrapEnvelope(body)
	var raw rawMessageDetail
	if err := json.Unmarshal(payload, &raw); err != nil {
		return MessageDetailDTO{}, apperr.New(apperr.CodeWBGatewayFailed, "解析邮件详情失败")
	}
	if raw.MessageID == "" {
		raw.MessageID = mid
	}
	return NormalizeMessageDetail(raw, quota), nil
}

func (c *Client) MarkAsRead(ctx context.Context, aliasID, messageID string) (DailyQuota, error) {
	aid, mid := strings.TrimSpace(aliasID), strings.TrimSpace(messageID)
	if aid == "" || mid == "" {
		return DailyQuota{}, apperr.New(apperr.CodeInvalidInput, "缺少邮件标识参数")
	}
	rel := "/console/agent-gateway/agentmailrest/v1/aliases/" + url.PathEscape(aid) + "/messages/" + url.PathEscape(mid) + "/update"
	status, body, quota, err := c.doRequest(ctx, http.MethodPost, rel, nil, map[string]any{"is_read": true}, MaxJSONResponseBytes)
	if err != nil {
		return quota, err
	}
	if err := mapRestError(status, body); err != nil {
		return quota, err
	}
	return quota, nil
}

func (c *Client) DeleteMessage(ctx context.Context, aliasID, messageID, confirmationToken string) (DeleteResultDTO, error) {
	aid, mid, tok := strings.TrimSpace(aliasID), strings.TrimSpace(messageID), strings.TrimSpace(confirmationToken)
	if aid == "" || mid == "" {
		return DeleteResultDTO{}, apperr.New(apperr.CodeInvalidInput, "缺少邮件标识参数")
	}
	rel := "/console/agent-gateway/agentmailrest/v1/aliases/" + url.PathEscape(aid) + "/messages/" + url.PathEscape(mid)
	var q url.Values
	if tok != "" {
		q = url.Values{"confirmation_token": {tok}}
	}
	status, body, quota, err := c.doRequest(ctx, http.MethodDelete, rel, q, nil, MaxJSONResponseBytes)
	if err != nil {
		return DeleteResultDTO{}, err
	}
	if tok == "" {
		if reqTok := extractConfirmationToken(body); reqTok != "" {
			return DeleteResultDTO{
				MessageID:         mid,
				NeedsConfirmation: true,
				ConfirmationToken: reqTok,
				DailyQuota:        quota,
			}, nil
		}
	}
	if err := mapRestError(status, body); err != nil {
		return DeleteResultDTO{}, err
	}
	return DeleteResultDTO{MessageID: mid, Deleted: true, DailyQuota: quota}, nil
}

func extractConfirmationToken(body []byte) string {
	var env rawErrorEnvelope
	if json.Unmarshal(body, &env) == nil && env.Error != nil && env.Error.Code == "CONFIRMATION_REQUIRED" {
		if t := strings.TrimSpace(env.Error.Details.ConfirmationToken); t != "" {
			return t
		}
	}
	_, _, payload := unwrapEnvelope(body)
	var direct struct {
		ConfirmationToken string `json:"confirmation_token"`
	}
	if json.Unmarshal(payload, &direct) == nil {
		return strings.TrimSpace(direct.ConfirmationToken)
	}
	return ""
}

func (c *Client) DownloadAttachment(ctx context.Context, aliasID, messageID, attachmentID string) (DecodedAttachment, error) {
	aid, mid, attID := strings.TrimSpace(aliasID), strings.TrimSpace(messageID), strings.TrimSpace(attachmentID)
	if aid == "" || mid == "" || attID == "" {
		return DecodedAttachment{}, apperr.New(apperr.CodeInvalidInput, "缺少附件标识参数")
	}
	rel := "/console/agent-gateway/agentmailrest/v1/aliases/" + url.PathEscape(aid) + "/messages/" + url.PathEscape(mid) + "/attachments/" + url.PathEscape(attID)
	status, body, quota, err := c.doRequest(ctx, http.MethodGet, rel, nil, nil, MaxAttachmentResponseBytes)
	if err != nil {
		return DecodedAttachment{}, err
	}
	if err := mapRestError(status, body); err != nil {
		return DecodedAttachment{}, err
	}
	_, _, payload := unwrapEnvelope(body)
	var raw struct {
		Content     string `json:"content"`
		Filename    string `json:"filename"`
		ContentType string `json:"content_type"`
	}
	if err := json.Unmarshal(payload, &raw); err != nil {
		return DecodedAttachment{}, apperr.New(apperr.CodeWBGatewayFailed, "解析附件数据失败")
	}
	decoded, err := streamDecodeBase64Capped(raw.Content, MaxAttachmentDecodedBytes)
	if err != nil {
		return DecodedAttachment{}, err
	}
	return DecodedAttachment{
		Filename:    mailproto.SanitizeFilename(raw.Filename),
		ContentType: strings.TrimSpace(raw.ContentType),
		Data:        decoded,
		DailyQuota:  quota,
	}, nil
}

func streamDecodeBase64Capped(encoded string, maxBytes int64) ([]byte, error) {
	clean := strings.TrimSpace(encoded)
	if idx := strings.Index(clean, ";base64,"); idx >= 0 {
		clean = clean[idx+len(";base64,"):]
	}
	clean = strings.Map(func(r rune) rune {
		if r == '\r' || r == '\n' || r == ' ' || r == '\t' {
			return -1
		}
		return r
	}, clean)
	enc := base64.StdEncoding
	if strings.ContainsAny(clean, "-_") {
		enc = base64.URLEncoding
	}
	if len(clean)%4 != 0 {
		enc = enc.WithPadding(base64.NoPadding)
	}
	dec := base64.NewDecoder(enc, strings.NewReader(clean))
	data, err := io.ReadAll(io.LimitReader(dec, maxBytes+1))
	if err != nil {
		return nil, apperr.New(apperr.CodeWBGatewayFailed, "附件 Base64 内容校验失败")
	}
	if int64(len(data)) > maxBytes {
		return nil, apperr.New(apperr.CodeWBAttachmentTooLarge, "附件体积超过 25MB 安全上限")
	}
	return data, nil
}
