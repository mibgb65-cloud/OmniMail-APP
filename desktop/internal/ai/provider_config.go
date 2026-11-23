package ai

import (
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
)

func NormalizeProviderConfig(cfg ProviderConfig, requireModel bool) (ProviderConfig, error) {
	provider, endpoint, err := config.ResolveAiEndpoint(cfg.Provider, cfg.BaseURL)
	if err != nil {
		return ProviderConfig{}, err
	}
	cfg.Provider, cfg.BaseURL = provider, endpoint
	if len(cfg.APIKey) > 4096 {
		return ProviderConfig{}, invalidAPIKey()
	}
	cfg.APIKey = strings.TrimSpace(cfg.APIKey)
	if strings.IndexFunc(cfg.APIKey, func(r rune) bool { return r < '!' || r > '~' }) >= 0 {
		return ProviderConfig{}, invalidAPIKey()
	}
	if cfg.APIKey != "" && !config.AiEndpointAllowsKey(endpoint) {
		return ProviderConfig{}, apperr.New(apperr.CodeInvalidInput, "非本机地址使用 API 密钥时必须使用 HTTPS")
	}
	cfg.Model = strings.TrimSpace(cfg.Model)
	if requireModel && (!validModelID(cfg.Model) || (cfg.APIKey != "" && strings.Contains(cfg.Model, cfg.APIKey))) {
		return ProviderConfig{}, apperr.New(apperr.CodeInvalidInput, "请选择或填写有效的模型名称")
	}
	return cfg, nil
}

func invalidAPIKey() error {
	return apperr.New(apperr.CodeInvalidInput, "API 密钥格式有误，请检查长度及空格")
}

func validModelID(id string) bool {
	return len(id) > 0 && len(id) <= 256 && utf8.ValidString(id) &&
		strings.IndexFunc(id, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) }) < 0
}

func requireProviderKey(cfg ProviderConfig) error {
	if config.AiPresetBaseURL(cfg.Provider) != "" && cfg.APIKey == "" {
		return &ProviderError{RunStatus: "invalid-key", Message: "请先填写此服务提供方的 API 密钥"}
	}
	return nil
}

func providerHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout: timeout,
		// 避免跳转到未经用户确认的服务器，尤其是会携带密钥的自定义请求头和查询参数。
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}
