package oauth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/microsoft"

	"omnimail/internal/apperr"
)

var (
	googleClientID  string
	outlookClientID string
)

type StoredToken struct {
	Provider     string `json:"provider"`
	ClientID     string `json:"clientId"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiryUnixMs int64  `json:"expiryUnixMs"`
}

type FlowStartResult struct {
	FlowID    string `json:"flowId"`
	AuthURL   string `json:"authUrl"`
	ExpiresAt int64  `json:"expiresAt"`
}

type CompletedOAuth struct {
	FlowID      string
	Provider    string
	Email       string
	DisplayName string
	Token       StoredToken
}

type pendingFlow struct {
	id       string
	server   *http.Server
	listener net.Listener
	cancel   context.CancelFunc
}

type Manager struct {
	mu    sync.Mutex
	flows map[string]*pendingFlow
}

func NewManager() *Manager {
	return &Manager{flows: make(map[string]*pendingFlow)}
}

func ResolveClientID(provider, customID string) string {
	if c := strings.TrimSpace(customID); c != "" {
		return c
	}
	if provider == "gmail" {
		if env := strings.TrimSpace(os.Getenv("OMNIMAIL_GOOGLE_CLIENT_ID")); env != "" {
			return env
		}
		return strings.TrimSpace(googleClientID)
	}
	if provider == "outlook" {
		if env := strings.TrimSpace(os.Getenv("OMNIMAIL_OUTLOOK_CLIENT_ID")); env != "" {
			return env
		}
		return strings.TrimSpace(outlookClientID)
	}
	return ""
}

func buildOAuthConfig(provider, clientID, redirectURL string) (*oauth2.Config, error) {
	switch provider {
	case "gmail":
		return &oauth2.Config{
			ClientID:    clientID,
			Endpoint:    google.Endpoint,
			RedirectURL: redirectURL,
			Scopes:      []string{"https://mail.google.com/", "openid", "email", "profile"},
		}, nil
	case "outlook":
		return &oauth2.Config{
			ClientID:    clientID,
			Endpoint:    microsoft.AzureADEndpoint("common"),
			RedirectURL: redirectURL,
			Scopes: []string{
				"offline_access",
				"https://outlook.office.com/IMAP.AccessAsUser.All",
				"https://outlook.office.com/SMTP.Send",
				"openid", "email", "profile",
			},
		}, nil
	default:
		return nil, apperr.New(apperr.CodeInvalidInput, "该邮箱服务商不支持 OAuth2 流程")
	}
}

func randomHex(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func parseIDTokenClaims(rawIDToken string) (email, name string) {
	parts := strings.Split(rawIDToken, ".")
	if len(parts) < 2 {
		return "", ""
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", ""
	}
	var claims map[string]any
	if json.Unmarshal(payload, &claims) != nil {
		return "", ""
	}
	for _, k := range []string{"email", "preferred_username", "upn"} {
		if v, ok := claims[k].(string); ok && strings.Contains(v, "@") {
			email = v
			break
		}
	}
	if v, ok := claims["name"].(string); ok {
		name = v
	}
	return email, name
}

func callbackHTML(ok bool, detail string) string {
	title := "授权已完成，请返回 OmniMail"
	color := "#059669"
	if !ok {
		title = "授权未完成"
		color = "#DC2626"
	}
	return fmt.Sprintf(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>OmniMail OAuth</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;background:#f8fafc;color:#0f172a;">
<div style="background:#fff;padding:32px 40px;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,.08);text-align:center;max-width:420px;">
<h2 style="margin:0 0 10px;color:%s;">%s</h2><p style="margin:0;color:#64748b;font-size:14px;">%s</p></div></body></html>`, color, title, detail)
}
