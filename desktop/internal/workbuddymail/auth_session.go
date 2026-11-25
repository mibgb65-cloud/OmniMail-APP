package workbuddymail

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

func (a *AuthClient) effectiveBase(creds TokenCredentials) (string, string) {
	if strings.TrimSpace(creds.BaseURL) != "" {
		if b, d, err := ResolveBaseURL(creds.BaseURL, a.allowLoopback); err == nil {
			return b, d
		}
	}
	if strings.TrimSpace(creds.Domain) != "" {
		if b, d, err := ResolveBaseURL(creds.Domain, a.allowLoopback); err == nil {
			return b, d
		}
	}
	return a.baseURL, a.domain
}

func (a *AuthClient) FetchAccountInfo(ctx context.Context, creds TokenCredentials) (TokenCredentials, error) {
	if strings.TrimSpace(creds.AccessToken) == "" {
		return creds, apperr.New(apperr.CodeWBAuthRequired, "缺少有效的 WorkBuddy 访问令牌")
	}
	base, domain := a.effectiveBase(creds)
	endpoint := base + "/v2" + AuthPrefixPath + "/account"
	headers := map[string]string{
		"Authorization": "Bearer " + creds.AccessToken,
		"X-Domain":      domain,
		"X-Product":     "SaaS",
	}
	interval := a.pollInterval
	if interval <= 0 {
		interval = time.Second
	}
	for {
		status, body, err := a.doRawJSON(ctx, http.MethodGet, endpoint, nil, headers)
		if err != nil {
			return creds, err
		}
		code, _, payload := unwrapEnvelope(body)
		if code == loginAccountPendingCode {
			timer := time.NewTimer(interval)
			select {
			case <-ctx.Done():
				timer.Stop()
				return creds, normalizeContextErr(ctx.Err())
			case <-timer.C:
				continue
			}
		}
		if status == http.StatusUnauthorized || status == http.StatusForbidden {
			return creds, apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 登录状态已失效，请重新授权")
		}
		if status >= 400 || code != 0 || len(payload) == 0 {
			return creds, apperr.New(apperr.CodeWBGatewayFailed, "获取 WorkBuddy 账号身份失败")
		}
		var raw struct {
			UID          string `json:"uid"`
			ID           string `json:"id"`
			UserID       string `json:"userId"`
			EnterpriseID string `json:"enterpriseId"`
			TenantID     string `json:"tenantId"`
		}
		if err := json.Unmarshal(payload, &raw); err != nil {
			return creds, apperr.New(apperr.CodeWBGatewayFailed, "解析 WorkBuddy 账号信息失败")
		}
		uid := firstNonEmpty(raw.UID, raw.ID, raw.UserID)
		if uid == "" {
			return creds, apperr.New(apperr.CodeWBGatewayFailed, "WorkBuddy 账号缺少有效用户标识")
		}
		ent := strings.TrimSpace(raw.EnterpriseID)
		tenant := firstNonEmpty(raw.TenantID, ent)
		creds.UID = uid
		creds.EnterpriseID = ent
		creds.TenantID = tenant
		creds.BaseURL = base
		creds.Domain = domain
		return creds, nil
	}
}

func (a *AuthClient) RefreshToken(ctx context.Context, creds TokenCredentials) (TokenCredentials, error) {
	if strings.TrimSpace(creds.RefreshToken) == "" {
		return creds, apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 授权已过期，请重新授权")
	}
	base, domain := a.effectiveBase(creds)
	endpoint := base + "/v2" + AuthPrefixPath + "/auth/token/refresh"
	headers := map[string]string{
		"X-Refresh-Token":       creds.RefreshToken,
		"X-Auth-Refresh-Source": "plugin",
		"X-Domain":              domain,
	}
	status, body, err := a.doRawJSON(ctx, http.MethodPost, endpoint, map[string]any{}, headers)
	if err != nil {
		return creds, err
	}
	code, _, payload := unwrapEnvelope(body)
	if status == http.StatusUnauthorized || status == http.StatusForbidden || code != 0 || status >= 400 || len(payload) == 0 {
		return creds, apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 授权续期失败，请重新授权")
	}
	var raw struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		Domain       string `json:"domain"`
		ExpiresIn    int64  `json:"expiresIn"`
		ExpiresAt    int64  `json:"expiresAt"`
	}
	if err := json.Unmarshal(payload, &raw); err != nil || strings.TrimSpace(raw.AccessToken) == "" {
		return creds, apperr.New(apperr.CodeWBAuthRequired, "WorkBuddy 续期响应缺少有效访问令牌")
	}
	next := creds
	next.AccessToken = strings.TrimSpace(raw.AccessToken)
	if strings.TrimSpace(raw.RefreshToken) != "" {
		next.RefreshToken = strings.TrimSpace(raw.RefreshToken)
	}
	if strings.TrimSpace(raw.Domain) != "" {
		if b, d, err := ResolveBaseURL(raw.Domain, a.allowLoopback); err == nil {
			next.BaseURL, next.Domain = b, d
		}
	}
	if exp := computeExpiresAt(raw.ExpiresAt, raw.ExpiresIn); exp > 0 {
		next.ExpiresAt = exp
	}
	return next, nil
}

func (a *AuthClient) Logout(ctx context.Context, creds TokenCredentials) error {
	if strings.TrimSpace(creds.RefreshToken) == "" {
		return nil
	}
	base, domain := a.effectiveBase(creds)
	endpoint := base + "/v2" + AuthPrefixPath + "/auth/logout"
	headers := map[string]string{
		"X-Refresh-Token":       creds.RefreshToken,
		"X-Auth-Refresh-Source": "plugin",
		"X-Domain":              domain,
	}
	_, _, err := a.doRawJSON(ctx, http.MethodPost, endpoint, map[string]any{}, headers)
	return err
}
