package config

import (
	"net/url"
	"strconv"
	"strings"

	"omnimail/internal/apperr"
)

const (
	TranslationProviderFree      = "bilibili"
	TranslationProviderAI        = "ai"
	DefaultTranslationEndpoint   = "https://api.bilibili.com/x/intl/translate/v2"
	DefaultTranslationTimeoutSec = 8
)

func NormalizeTranslationEndpoint(value string) (string, error) {
	value = strings.TrimSpace(value)
	u, err := url.Parse(value)
	if len(value) > 2048 || err != nil || u.Hostname() == "" || u.User != nil ||
		(u.Scheme != "http" && u.Scheme != "https") || strings.ContainsAny(value, "?#\\") {
		return "", apperr.New(apperr.CodeInvalidInput, "请输入有效的 HTTP(S) 翻译端点，不含账号、查询参数或锚点")
	}
	if port := u.Port(); port != "" {
		if n, err := strconv.Atoi(port); err != nil || n < 1 || n > 65535 {
			return "", apperr.New(apperr.CodeInvalidInput, "翻译端点端口无效")
		}
	}
	u.Host = strings.ToLower(u.Host)
	return u.String(), nil
}

func ValidateTranslationSettingsPatch(patch AppSettingsPatch) error {
	if p := patch.TranslationProvider; p != nil && *p != TranslationProviderFree && *p != TranslationProviderAI {
		return apperr.New(apperr.CodeInvalidInput, "不支持的翻译服务提供商")
	}
	if secs := patch.TranslationTimeoutSec; secs != nil && !validTranslationTimeout(*secs) {
		return apperr.New(apperr.CodeInvalidInput, "翻译请求超时应为 1 至 30 秒")
	}
	if endpoint := patch.TranslationEndpoint; endpoint != nil {
		_, err := NormalizeTranslationEndpoint(*endpoint)
		return err
	}
	return nil
}

func validTranslationTimeout(sec int) bool { return sec >= 1 && sec <= 30 }

func normalizeStoredTranslationSettings(s *AppSettings) {
	if s.TranslationProvider != TranslationProviderAI && s.TranslationProvider != TranslationProviderFree {
		s.TranslationProvider = TranslationProviderFree
		s.TranslationEnabled = false
	}
	if endpoint, err := NormalizeTranslationEndpoint(s.TranslationEndpoint); err == nil {
		s.TranslationEndpoint = endpoint
	} else {
		// 非法存量地址不能悄悄改发给另一家端点。
		s.TranslationEndpoint = DefaultTranslationEndpoint
		s.TranslationEnabled = false
	}
	if !validTranslationTimeout(s.TranslationTimeoutSec) {
		s.TranslationTimeoutSec = DefaultTranslationTimeoutSec
	}
}
