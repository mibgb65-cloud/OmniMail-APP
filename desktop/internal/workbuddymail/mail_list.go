package workbuddymail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"omnimail/internal/apperr"
)

func (c *Client) ListMessages(ctx context.Context, aliasID, dir, cursor string, limit int) (MessageListDTO, error) {
	return c.fetchMessagePage(ctx, aliasID, dir, "", cursor, limit)
}

func (c *Client) SearchMessages(ctx context.Context, aliasID, dir, query, cursor string, limit int) (MessageListDTO, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return c.ListMessages(ctx, aliasID, dir, cursor, limit)
	}
	return c.fetchMessagePage(ctx, aliasID, dir, trimmed, cursor, limit)
}

func (c *Client) fetchMessagePage(ctx context.Context, aliasID, dir, keyword, cursor string, limit int) (MessageListDTO, error) {
	aid := strings.TrimSpace(aliasID)
	if aid == "" {
		return MessageListDTO{}, apperr.New(apperr.CodeInvalidInput, "缺少邮箱别名标识")
	}
	normDir := normalizeDir(dir)
	if limit <= 0 || limit > 100 {
		limit = DefaultPageSize
	}
	q := url.Values{"dir": {normDir}, "limit": {strconv.Itoa(limit)}}
	if strings.TrimSpace(cursor) != "" {
		q.Set("cursor", strings.TrimSpace(cursor))
	}
	rel := "/console/agent-gateway/agentmailrest/v1/aliases/" + url.PathEscape(aid) + "/messages"
	if keyword != "" {
		rel += "/search"
		q.Set("q", keyword)
		q.Set("search_in", "SEARCH_IN_ALL")
	}
	status, body, quota, err := c.doRequest(ctx, http.MethodGet, rel, q, nil, MaxJSONResponseBytes)
	if err != nil {
		return MessageListDTO{}, err
	}
	if err := mapRestError(status, body); err != nil {
		return MessageListDTO{}, err
	}
	var resp struct {
		Data       []rawMessageSummary `json:"data"`
		Pagination struct {
			NextCursor string `json:"next_cursor"`
			HasMore    bool   `json:"has_more"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return MessageListDTO{}, apperr.New(apperr.CodeWBGatewayFailed, "解析智能体邮件列表失败")
	}
	items := make([]MessageSummaryDTO, 0, len(resp.Data))
	for _, r := range resp.Data {
		if id := strings.TrimSpace(r.MessageID); id != "" {
			items = append(items, MessageSummaryDTO{
				MessageID:      id,
				Subject:        strings.TrimSpace(r.Subject),
				From:           parseSingleAddress(r.From),
				To:             parseAddressList(r.To),
				Snippet:        strings.TrimSpace(r.Snippet),
				CreatedAt:      parseTimestamp(r.CreatedAt),
				IsRead:         r.IsRead,
				HasAttachments: r.HasAttachments || len(r.Attachments) > 0,
				Direction:      normDir,
			})
		}
	}
	return MessageListDTO{
		Items:      items,
		NextCursor: strings.TrimSpace(resp.Pagination.NextCursor),
		HasMore:    resp.Pagination.HasMore,
		DailyQuota: quota,
	}, nil
}

func normalizeDir(dir string) string {
	if strings.EqualFold(strings.TrimSpace(dir), "sent") {
		return "sent"
	}
	return "inbox"
}
