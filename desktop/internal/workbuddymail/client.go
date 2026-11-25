package workbuddymail

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"omnimail/internal/apperr"
)

type refreshCall struct {
	done  chan struct{}
	creds TokenCredentials
	err   error
}

// Client 封装统一请求头注入、配额响应头提取与并发防重单次 401 自动续期。
type Client struct {
	mu          sync.Mutex
	creds       TokenCredentials
	httpClient  *http.Client
	auth        *AuthClient
	inFlight    *refreshCall
	onRefreshed func(TokenCredentials) error
}

func NewClient(creds TokenCredentials, cfg TransportConfig, onRefreshed func(TokenCredentials) error) (*Client, error) {
	base := creds.BaseURL
	if strings.TrimSpace(base) == "" {
		base = creds.Domain
	}
	authClient, err := NewAuthClient(base, cfg)
	if err != nil {
		return nil, err
	}
	resolvedBase, domain, _ := ResolveBaseURL(base, cfg.AllowLoopbackHTTP)
	creds.BaseURL = resolvedBase
	if creds.Domain == "" {
		creds.Domain = domain
	}
	hc := cfg.HTTPClient
	if hc == nil {
		hc = newSafeHTTPClient(25*time.Second, cfg.AllowLoopbackHTTP)
	}
	return &Client{
		creds:       creds,
		httpClient:  hc,
		auth:        authClient,
		onRefreshed: onRefreshed,
	}, nil
}

func (c *Client) Credentials() TokenCredentials {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.creds
}

func (c *Client) doRequest(
	ctx context.Context,
	method, relPath string,
	query url.Values,
	reqBody any,
	maxBytes int64,
) (int, []byte, DailyQuota, error) {
	var payload []byte
	if reqBody != nil {
		var err error
		payload, err = json.Marshal(reqBody)
		if err != nil {
			return 0, nil, DailyQuota{}, apperr.New(apperr.CodeInternal, "序列化请求参数失败")
		}
	}
	creds := c.Credentials()
	status, data, quota, err := c.execOnce(ctx, creds, method, relPath, query, payload, maxBytes)
	if err != nil {
		return 0, nil, DailyQuota{}, err
	}
	if !shouldRefreshToken(status, data) {
		return status, data, quota, nil
	}
	refreshed, err := c.refreshSingleFlight(ctx, creds.AccessToken)
	if err != nil {
		return 0, nil, quota, err
	}
	return c.execOnce(ctx, refreshed, method, relPath, query, payload, maxBytes)
}

func (c *Client) execOnce(
	ctx context.Context,
	creds TokenCredentials,
	method, relPath string,
	query url.Values,
	payload []byte,
	maxBytes int64,
) (int, []byte, DailyQuota, error) {
	endpoint := strings.TrimRight(creds.BaseURL, "/") + relPath
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}
	var bodyReader io.Reader
	if payload != nil {
		bodyReader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return 0, nil, DailyQuota{}, apperr.New(apperr.CodeWBGatewayFailed, "创建 WorkBuddy 请求失败")
	}
	req.Header.Set("Accept", "application/json")
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if creds.AccessToken != "" {
		req.Header.Set("Authorization", "Bearer "+creds.AccessToken)
	}
	if creds.UID != "" {
		req.Header.Set("X-User-Id", url.QueryEscape(creds.UID))
	}
	if creds.EnterpriseID != "" {
		req.Header.Set("X-Enterprise-Id", creds.EnterpriseID)
	}
	if creds.TenantID != "" {
		req.Header.Set("X-Tenant-Id", creds.TenantID)
	}
	if creds.Domain != "" {
		req.Header.Set("X-Domain", creds.Domain)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, DailyQuota{}, normalizeContextErr(err)
	}
	defer resp.Body.Close()

	quota := ParseDailyQuotaHeaders(resp.Header)
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return 0, nil, quota, apperr.New(apperr.CodeWBGatewayFailed, "读取 WorkBuddy 响应失败")
	}
	if int64(len(data)) > maxBytes {
		if maxBytes == MaxAttachmentResponseBytes {
			return 0, nil, quota, apperr.New(apperr.CodeWBAttachmentTooLarge, "附件体积超过 25MB 安全上限")
		}
		return 0, nil, quota, apperr.New(apperr.CodeWBGatewayFailed, "WorkBuddy 响应体超出大小上限")
	}
	return resp.StatusCode, data, quota, nil
}

func (c *Client) refreshSingleFlight(ctx context.Context, staleAccessToken string) (TokenCredentials, error) {
	c.mu.Lock()
	if c.creds.AccessToken != "" && c.creds.AccessToken != staleAccessToken {
		latest := c.creds
		c.mu.Unlock()
		return latest, nil
	}
	if c.inFlight != nil {
		call := c.inFlight
		c.mu.Unlock()
		select {
		case <-ctx.Done():
			return TokenCredentials{}, normalizeContextErr(ctx.Err())
		case <-call.done:
			return call.creds, call.err
		}
	}
	call := &refreshCall{done: make(chan struct{})}
	snapshot := c.creds
	c.inFlight = call
	c.mu.Unlock()

	refCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
	next, err := c.auth.RefreshToken(refCtx, snapshot)
	cancel()
	if err == nil && c.onRefreshed != nil {
		_ = c.onRefreshed(next)
	}
	c.mu.Lock()
	if err == nil {
		c.creds = next
	}
	call.creds = next
	call.err = err
	c.inFlight = nil
	close(call.done)
	c.mu.Unlock()
	return next, err
}
