package config

import (
	"crypto/sha256"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"

	"omnimail/internal/apperr"
)

const OllamaDefaultBaseURL = "http://127.0.0.1:11434/v1"

func AiPresetBaseURL(provider string) string {
	switch provider {
	case "openai":
		return "https://api.openai.com/v1"
	case "deepseek":
		return "https://api.deepseek.com/v1"
	case "claude":
		return "https://api.anthropic.com/v1"
	case "gemini":
		return "https://generativelanguage.googleapis.com/v1beta"
	default:
		return ""
	}
}

func ResolveAiEndpoint(provider, baseURL string) (string, string, error) {
	if len(provider) > 32 {
		return "", "", apperr.New(apperr.CodeInvalidInput, "不支持该 AI 服务提供方")
	}
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		provider = "openai"
	}
	if official := AiPresetBaseURL(provider); official != "" {
		// 旧配置、表单残留和 IPC 参数都不能覆盖官方域名。
		return provider, official, nil
	}
	if provider != "custom" && provider != "ollama" {
		return "", "", apperr.New(apperr.CodeInvalidInput, "不支持该 AI 服务提供方")
	}
	if len(baseURL) > 2048 {
		return "", "", invalidAiBaseURL()
	}
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" && provider == "ollama" {
		baseURL = OllamaDefaultBaseURL
	}
	u, err := url.Parse(baseURL)
	if err != nil || u.Hostname() == "" || u.User != nil ||
		(u.Scheme != "http" && u.Scheme != "https") || strings.ContainsAny(baseURL, "?#\\") {
		return "", "", invalidAiBaseURL()
	}
	if port := u.Port(); port != "" {
		if n, err := strconv.Atoi(port); err != nil || n < 1 || n > 65535 {
			return "", "", invalidAiBaseURL()
		}
	}
	u.Host = strings.ToLower(u.Host)
	return provider, u.String(), nil
}

func invalidAiBaseURL() error {
	return apperr.New(apperr.CodeInvalidInput, "请输入有效的 HTTP(S) Base URL，不含用户名、密码、查询参数或锚点")
}

func AiEndpointAllowsKey(baseURL string) bool {
	u, err := url.Parse(baseURL)
	if err != nil {
		return false
	}
	host := u.Hostname()
	return u.Scheme == "https" || host == "localhost" || net.ParseIP(host).IsLoopback()
}

func LegacyAiVaultKey(provider string) string {
	return "ai:provider:" + provider + ":api_key"
}

// AiVaultKey 的参数必须已经规范化。自定义端点互不共用加密密钥。
func AiVaultKey(provider, baseURL string) string {
	if AiPresetBaseURL(provider) != "" {
		return LegacyAiVaultKey(provider)
	}
	return fmt.Sprintf("ai:provider:%s:endpoint:%x:api_key", provider, sha256.Sum256([]byte(baseURL)))
}
