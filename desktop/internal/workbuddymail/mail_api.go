package workbuddymail

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"omnimail/internal/apperr"
)

type rawAttachmentMeta struct {
	AttachmentID string `json:"attachment_id"`
	Filename     string `json:"filename"`
	Size         int64  `json:"size"`
	ContentType  string `json:"content_type"`
}

type rawMessageSummary struct {
	MessageID      string              `json:"message_id"`
	Subject        string              `json:"subject"`
	From           json.RawMessage     `json:"from"`
	To             json.RawMessage     `json:"to"`
	Snippet        string              `json:"snippet"`
	CreatedAt      json.RawMessage     `json:"created_at"`
	IsRead         bool                `json:"is_read"`
	HasAttachments bool                `json:"has_attachments"`
	Attachments    []rawAttachmentMeta `json:"attachments"`
}

type rawMessageDetail struct {
	MessageID   string              `json:"message_id"`
	Subject     string              `json:"subject"`
	From        json.RawMessage     `json:"from"`
	To          json.RawMessage     `json:"to"`
	Cc          json.RawMessage     `json:"cc"`
	CreatedAt   json.RawMessage     `json:"created_at"`
	IsRead      bool                `json:"is_read"`
	Body        string              `json:"body"`
	BodyFormat  string              `json:"body_format"`
	Attachments []rawAttachmentMeta `json:"attachments"`
}

func (c *Client) GetConnectorStatus(ctx context.Context) (ConnectorState, error) {
	status, body, _, err := c.doRequest(ctx, http.MethodGet, "/v2/as/connector/agentmail/me", nil, nil, MaxJSONResponseBytes)
	if err != nil {
		return ConnectorState{}, err
	}
	if status == http.StatusUnauthorized || status == http.StatusForbidden {
		return ConnectorState{}, apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 登录状态已失效，请重新授权")
	}
	code, msg, payload := unwrapEnvelope(body)
	if status >= 400 {
		return ConnectorState{}, apperr.New(apperr.CodeWBGatewayFailed, formatConnectorStatusError(status, code, msg))
	}
	if code != 0 {
		if isExplicitNotBoundMsg(msg) {
			return ConnectorState{Status: StatusNotBound}, nil
		}
		return ConnectorState{}, apperr.New(apperr.CodeWBGatewayFailed, formatConnectorStatusError(status, code, msg))
	}
	if len(payload) == 0 {
		return ConnectorState{Status: StatusNotBound}, nil
	}
	var raw struct {
		Status   string          `json:"status"`
		Alias    string          `json:"alias"`
		OpenedAt json.RawMessage `json:"openedAt"`
		UserType string          `json:"userType"`
	}
	if err := json.Unmarshal(payload, &raw); err != nil {
		return ConnectorState{}, apperr.New(apperr.CodeWBGatewayFailed, "解析智能体邮箱开通状态失败")
	}
	return ConnectorState{
		Status:   NormalizeMailboxStatus(raw.Status),
		Alias:    strings.TrimSpace(raw.Alias),
		OpenedAt: parseOpenedAtUnixMs(raw.OpenedAt),
		UserType: strings.TrimSpace(raw.UserType),
	}, nil
}

func isExplicitNotBoundMsg(msg string) bool {
	low := strings.ToLower(strings.TrimSpace(msg))
	return low == "not_bound" || low == "mailbox_not_bound" || low == "agentmail_not_bound"
}

func formatConnectorStatusError(status, code int, msg string) string {
	clean := sanitizeServerMessage(msg)
	if clean != "" {
		return fmt.Sprintf("查询智能体邮箱状态失败：%s", clean)
	}
	if code != 0 {
		return fmt.Sprintf("查询智能体邮箱状态失败（code=%d）", code)
	}
	return fmt.Sprintf("查询智能体邮箱状态失败（HTTP %d）", status)
}

func (c *Client) GetMeAndAliases(ctx context.Context, preferredEmail string) ([]Alias, Alias, DailyQuota, error) {
	status, body, quota, err := c.doRequest(ctx, http.MethodGet, "/console/agent-gateway/agentmailrest/v1/me", nil, nil, MaxJSONResponseBytes)
	if err != nil {
		return nil, Alias{}, quota, err
	}
	if err := mapRestError(status, body); err != nil {
		return nil, Alias{}, quota, err
	}
	_, _, payload := unwrapEnvelope(body)
	var raw struct {
		Aliases []struct {
			AliasID   string `json:"alias_id"`
			AliasID2  string `json:"aliasId"`
			Email     string `json:"email"`
			IsPrimary bool   `json:"is_primary"`
			Status    string `json:"status"`
		} `json:"aliases"`
		DailyQuota *struct {
			Limit     int `json:"limit"`
			Remaining int `json:"remaining"`
			Reset     int `json:"reset"`
		} `json:"daily_quota"`
	}
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, Alias{}, quota, apperr.New(apperr.CodeWBGatewayFailed, "解析智能体邮箱别名失败")
	}
	if !quota.HasQuota && raw.DailyQuota != nil {
		quota = DailyQuota{
			Limit:     raw.DailyQuota.Limit,
			Remaining: raw.DailyQuota.Remaining,
			Reset:     raw.DailyQuota.Reset,
			HasQuota:  true,
		}
	}
	aliases := make([]Alias, 0, len(raw.Aliases))
	for _, item := range raw.Aliases {
		if s := strings.TrimSpace(item.Status); s != "" {
			norm := NormalizeMailboxStatus(s)
			if norm == StatusNotBound || norm == StatusDeleted || norm == StatusRevoked {
				continue
			}
		}
		id := firstNonEmpty(item.AliasID, item.AliasID2)
		em := strings.TrimSpace(item.Email)
		if id != "" && em != "" {
			aliases = append(aliases, Alias{AliasID: id, Email: em, IsPrimary: item.IsPrimary})
		}
	}
	if len(aliases) == 0 {
		return nil, Alias{}, quota, apperr.New(apperr.CodeWBNotBound, "当前账号尚未绑定可用的智能体邮箱别名")
	}
	return aliases, selectPrimaryAlias(aliases, preferredEmail), quota, nil
}

func selectPrimaryAlias(aliases []Alias, preferredEmail string) Alias {
	pref := strings.ToLower(strings.TrimSpace(preferredEmail))
	if pref != "" {
		for _, a := range aliases {
			if strings.EqualFold(a.Email, pref) {
				return a
			}
		}
	}
	for _, a := range aliases {
		if a.IsPrimary {
			return a
		}
	}
	return aliases[0]
}
