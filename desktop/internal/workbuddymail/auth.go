package workbuddymail

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

type AuthClient struct {
	httpClient    *http.Client
	baseURL       string
	domain        string
	pollInterval  time.Duration
	allowLoopback bool
}

func NewAuthClient(baseURL string, cfg TransportConfig) (*AuthClient, error) {
	resolvedBase, domain, err := ResolveBaseURL(baseURL, cfg.AllowLoopbackHTTP)
	if err != nil {
		return nil, err
	}
	hc := cfg.HTTPClient
	if hc == nil {
		hc = newSafeHTTPClient(15*time.Second, cfg.AllowLoopbackHTTP)
	}
	return &AuthClient{
		httpClient:    hc,
		baseURL:       resolvedBase,
		domain:        domain,
		pollInterval:  time.Second,
		allowLoopback: cfg.AllowLoopbackHTTP,
	}, nil
}

func (a *AuthClient) SetPollInterval(d time.Duration) {
	if d > 0 {
		a.pollInterval = d
	}
}

func (a *AuthClient) StartBrowserAuth(ctx context.Context) (AuthStartResult, error) {
	endpoint := a.baseURL + "/v2" + AuthPrefixPath + "/auth/state?platform=" + AuthPlatform
	status, body, err := a.doRawJSON(ctx, http.MethodPost, endpoint, map[string]any{}, nil)
	if err != nil {
		return AuthStartResult{}, err
	}
	code, _, payload := unwrapEnvelope(body)
	if status >= 400 || code != 0 || len(payload) == 0 {
		return AuthStartResult{}, apperr.New(apperr.CodeWBGatewayFailed, "发起 WorkBuddy 浏览器授权失败")
	}
	var parsed struct {
		State   string `json:"state"`
		AuthURL string `json:"authUrl"`
	}
	if err := json.Unmarshal(payload, &parsed); err != nil || strings.TrimSpace(parsed.State) == "" {
		return AuthStartResult{}, apperr.New(apperr.CodeWBGatewayFailed, "WorkBuddy 授权状态响应无效")
	}
	safeURL, err := ValidateAuthBrowserURL(parsed.AuthURL, a.allowLoopback)
	if err != nil {
		return AuthStartResult{}, err
	}
	return AuthStartResult{
		State:   strings.TrimSpace(parsed.State),
		AuthURL: safeURL,
		BaseURL: a.baseURL,
	}, nil
}

func (a *AuthClient) PollAuthTokenOnce(ctx context.Context, state string) (TokenCredentials, bool, error) {
	endpoint := a.baseURL + "/v2" + AuthPrefixPath + "/auth/token?state=" + url.QueryEscape(strings.TrimSpace(state))
	status, body, err := a.doRawJSON(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return TokenCredentials{}, false, err
	}
	if status == http.StatusAccepted {
		return TokenCredentials{}, true, nil
	}
	code, _, payload := unwrapEnvelope(body)
	if code == loginTokenPendingCode {
		return TokenCredentials{}, true, nil
	}
	if status >= 400 || (code != 0 && len(payload) == 0) {
		return TokenCredentials{}, false, apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 浏览器授权未完成或已失效")
	}
	if len(payload) == 0 {
		return TokenCredentials{}, true, nil
	}
	var raw struct {
		Status       string `json:"status"`
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		Domain       string `json:"domain"`
		ExpiresIn    int64  `json:"expiresIn"`
		ExpiresAt    int64  `json:"expiresAt"`
	}
	if err := json.Unmarshal(payload, &raw); err != nil {
		return TokenCredentials{}, false, apperr.New(apperr.CodeWBGatewayFailed, "解析 WorkBuddy 授权凭据失败")
	}
	if strings.TrimSpace(raw.AccessToken) == "" {
		if raw.Status == "" || strings.EqualFold(raw.Status, "pending") {
			return TokenCredentials{}, true, nil
		}
		return TokenCredentials{}, false, apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 授权已被拒绝或过期")
	}
	effBase, effDomain := a.baseURL, a.domain
	if strings.TrimSpace(raw.Domain) != "" {
		if b, d, err := ResolveBaseURL(raw.Domain, a.allowLoopback); err == nil {
			effBase, effDomain = b, d
		}
	}
	return TokenCredentials{
		AccessToken:  strings.TrimSpace(raw.AccessToken),
		RefreshToken: strings.TrimSpace(raw.RefreshToken),
		Domain:       effDomain,
		BaseURL:      effBase,
		ExpiresAt:    computeExpiresAt(raw.ExpiresAt, raw.ExpiresIn),
	}, false, nil
}

func (a *AuthClient) PollAuthToken(ctx context.Context, state string) (TokenCredentials, error) {
	if strings.TrimSpace(state) == "" {
		return TokenCredentials{}, apperr.New(apperr.CodeInvalidInput, "缺少授权状态标识")
	}
	for {
		creds, pending, err := a.PollAuthTokenOnce(ctx, state)
		if err != nil {
			return TokenCredentials{}, normalizeContextErr(err)
		}
		if !pending {
			return creds, nil
		}
		timer := time.NewTimer(a.pollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return TokenCredentials{}, normalizeContextErr(ctx.Err())
		case <-timer.C:
		}
	}
}

func (a *AuthClient) doRawJSON(
	ctx context.Context,
	method, endpoint string,
	reqBody any,
	headers map[string]string,
) (int, []byte, error) {
	var reader io.Reader
	if reqBody != nil {
		buf, err := json.Marshal(reqBody)
		if err != nil {
			return 0, nil, apperr.New(apperr.CodeInternal, "序列化请求体失败")
		}
		reader = bytes.NewReader(buf)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return 0, nil, apperr.New(apperr.CodeWBGatewayFailed, "构造 WorkBuddy 请求失败")
	}
	req.Header.Set("Accept", "application/json")
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if a.domain != "" {
		req.Header.Set("X-Domain", a.domain)
	}
	for k, v := range headers {
		if v != "" {
			req.Header.Set(k, v)
		}
	}
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return 0, nil, normalizeContextErr(err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, MaxJSONResponseBytes+1))
	if err != nil || int64(len(data)) > MaxJSONResponseBytes {
		return 0, nil, apperr.New(apperr.CodeWBGatewayFailed, "读取 WorkBuddy 服务响应失败")
	}
	return resp.StatusCode, data, nil
}
