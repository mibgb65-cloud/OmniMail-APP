package domain

import (
	"context"
	"errors"
	"net"
	"net/url"
	"regexp"
	"strings"
)

var (
	ErrAIInput       = errors.New("AI_INVALID_INPUT")
	ErrAIConfig      = errors.New("AI_NOT_CONFIGURED")
	ErrAIConsent     = errors.New("AI_CONSENT_REQUIRED")
	ErrAIBusy        = errors.New("AI_BUSY")
	ErrAIUnavailable = errors.New("AI_UNAVAILABLE")
	ErrAIResponse    = errors.New("AI_INVALID_RESPONSE")
	ErrAIRate        = errors.New("AI_RATE_LIMITED")
	ErrAIStorage     = errors.New("AI_STORAGE_FAILED")
	ErrAINotReady    = errors.New("AI_BODY_NOT_READY")
	ErrAITooLarge    = errors.New("AI_TOO_LARGE")
)

const AIFormat = "mail-assistant-v1"

type AIConfig struct {
	Endpoint string `json:"endpoint"`
	Model    string `json:"model"`
	Language string `json:"language"`
	Consent  bool   `json:"consent"`
	HasKey   bool   `json:"hasKey"`
	Revision string `json:"revision"`
}

type AIConfigInput struct {
	Endpoint  string `json:"endpoint"`
	Model     string `json:"model"`
	Language  string `json:"language"`
	Consent   bool   `json:"consent"`
	APIKey    string `json:"apiKey"`
	RemoveKey bool   `json:"removeKey"`
}

type AIStoredConfig struct {
	Config        AIConfig `json:"config"`
	CredentialRef string   `json:"credentialRef"`
}

type AIConfigStore interface {
	ReadAIConfig(context.Context) (AIStoredConfig, error)
	WriteAIConfig(context.Context, AIStoredConfig) error
}

var aiModelPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$`)

// 这里接收 API base URL，而非任意完整请求。HTTP 只给本机模型；云端一律校验 TLS。
func NormalizeAIEndpoint(value string) (string, error) {
	if len(value) > 2048 || strings.TrimSpace(value) != value || strings.ContainsAny(value, "\\\r\n\t#") {
		return "", ErrAIInput
	}
	u, err := url.Parse(value)
	if err != nil || u.Opaque != "" || u.User != nil || u.Hostname() == "" ||
		u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || u.RawFragment != "" ||
		u.RawPath != "" || strings.Contains(u.Path, "..") {
		return "", ErrAIInput
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return "", ErrAIInput
	}
	if u.Scheme == "http" {
		ip := net.ParseIP(u.Hostname())
		if u.Hostname() != "localhost" && (ip == nil || !ip.IsLoopback()) {
			return "", ErrAIInput
		}
	}
	if port := u.Port(); port != "" {
		n := 0
		for _, c := range port {
			if c < '0' || c > '9' {
				return "", ErrAIInput
			}
			n = n*10 + int(c-'0')
			if n > 65535 {
				return "", ErrAIInput
			}
		}
		if n == 0 {
			return "", ErrAIInput
		}
	}
	if strings.HasSuffix(strings.TrimRight(u.Path, "/"), "/chat/completions") {
		return "", ErrAIInput
	}
	u.Host = strings.ToLower(u.Host)
	u.Path = strings.TrimRight(u.Path, "/")
	return u.String(), nil
}

func (c AIConfigInput) Validate() error {
	if c.Language != "zh" && c.Language != "en" || c.RemoveKey && c.APIKey != "" || len(c.APIKey) > 2048 {
		return ErrAIInput
	}
	for _, r := range c.APIKey {
		if r < 33 || r > 126 {
			return ErrAIInput
		}
	}
	if c.Endpoint == "" && c.Model == "" && !c.Consent && c.APIKey == "" {
		return nil
	}
	if _, err := NormalizeAIEndpoint(c.Endpoint); err != nil || !aiModelPattern.MatchString(c.Model) {
		return ErrAIInput
	}
	return nil
}
