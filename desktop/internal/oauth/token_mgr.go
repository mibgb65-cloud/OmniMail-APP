package oauth

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

	"omnimail/internal/apperr"
	"omnimail/internal/security"
)

type TokenManager struct {
	sf singleflight.Group
}

func NewTokenManager() *TokenManager {
	return &TokenManager{}
}

func VaultOAuthKey(accountID string) string {
	return "account:" + accountID + ":oauth_token"
}

func SaveTokenToVault(vault *security.Vault, accountID string, tok StoredToken) error {
	raw, err := json.Marshal(tok)
	if err != nil {
		return err
	}
	defer func() {
		for i := range raw {
			raw[i] = 0
		}
	}()
	return vault.Set(VaultOAuthKey(accountID), string(raw))
}

// GetValidAccessToken 并发安全地获取有效 OAuth AccessToken；剩余不足 5 分钟时自动刷新并写回凭据盒。
func (tm *TokenManager) GetValidAccessToken(
	ctx context.Context,
	vault *security.Vault,
	accountID, provider, fallbackClientID string,
) (string, error) {
	val, err, _ := tm.sf.Do(accountID, func() (any, error) {
		raw, ok := vault.Get(VaultOAuthKey(accountID))
		if !ok || strings.TrimSpace(raw) == "" {
			return "", apperr.New(apperr.CodeAuthExpired, "本地凭据盒缺少 OAuth 令牌，请重新授权")
		}
		var stored StoredToken
		if err := json.Unmarshal([]byte(raw), &stored); err != nil {
			return "", apperr.New(apperr.CodeAuthExpired, "OAuth 令牌记录已损坏，请重新授权")
		}
		exp := time.UnixMilli(stored.ExpiryUnixMs)
		if stored.AccessToken != "" && time.Until(exp) > 5*time.Minute {
			return stored.AccessToken, nil
		}
		if strings.TrimSpace(stored.RefreshToken) == "" {
			return "", apperr.New(apperr.CodeAuthExpired, "授权已过期且无刷新令牌，请重新授权")
		}
		cid := ResolveClientID(provider, stored.ClientID)
		if cid == "" {
			cid = ResolveClientID(provider, fallbackClientID)
		}
		oauthCfg, err := buildOAuthConfig(provider, cid, "")
		if err != nil {
			return "", err
		}
		src := oauthCfg.TokenSource(ctx, &oauth2.Token{
			RefreshToken: stored.RefreshToken,
			Expiry:       time.Now().Add(-time.Minute),
		})
		refreshed, err := src.Token()
		if err != nil {
			msg := strings.ToLower(err.Error())
			if strings.Contains(msg, "invalid_grant") || strings.Contains(msg, "interaction_required") {
				return "", apperr.New(apperr.CodeAuthExpired, "邮箱授权已失效或被撤销，请重新验证")
			}
			return "", apperr.New(apperr.CodeConnFailed, "刷新 OAuth 令牌失败: "+security.RedactSensitive(err.Error()))
		}
		stored.AccessToken = refreshed.AccessToken
		if refreshed.RefreshToken != "" {
			stored.RefreshToken = refreshed.RefreshToken
		}
		stored.ExpiryUnixMs = refreshed.Expiry.UnixMilli()
		_ = SaveTokenToVault(vault, accountID, stored)
		return stored.AccessToken, nil
	})
	if err != nil {
		return "", err
	}
	return val.(string), nil
}
