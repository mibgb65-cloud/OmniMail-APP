package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

const (
	noTranslationRetry       = -1
	translationRetryDelay    = 500 * time.Millisecond
	maxTranslationRetryDelay = 3 * time.Second
	translationSettingsHint  = "请在「设置 → 邮件翻译」检查端点，或切换到「AI 助手模型」。"
)

func translationServiceFailure(reason string) error {
	return apperr.New(apperr.CodeTranslationFailed, reason+"。"+translationSettingsHint)
}

func translationHTTPFailure(status int, retryAfter string) (string, time.Duration, error) {
	switch status {
	case http.StatusTooManyRequests, http.StatusPreconditionFailed:
		return "", translationRetryAfter(retryAfter, time.Now()),
			translationServiceFailure("翻译服务暂时限制请求，请稍后再试")
	case http.StatusRequestTimeout, http.StatusInternalServerError, http.StatusBadGateway,
		http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return "", translationRetryAfter(retryAfter, time.Now()),
			translationServiceFailure("翻译服务暂时不可用，请稍后重试")
	case http.StatusUnauthorized, http.StatusForbidden:
		return "", noTranslationRetry, translationServiceFailure("翻译服务拒绝请求")
	case http.StatusNotFound:
		return "", noTranslationRetry, translationServiceFailure("翻译接口不存在")
	default:
		return "", noTranslationRetry, translationServiceFailure("翻译服务未接受请求")
	}
}

func translationBusinessFailure(code json.RawMessage, rateHeader string) (string, time.Duration, error) {
	// 官方接口使用 OpenAI 错误对象；自定义兼容网关也可能在 HTTP 200 中附上业务码。
	value := strings.ToLower(strings.Trim(string(code), "\" "))
	switch value {
	case "429", "-412", "-509", "rate_limit_exceeded", "too_many_requests":
		return "", translationRetryAfter(rateHeader, time.Now()),
			translationServiceFailure("翻译服务暂时限制请求，请稍后再试")
	case "-400", "-401", "-403", "-404", "invalid_request_error",
		"invalid_api_key", "insufficient_quota", "model_not_found":
		return "", noTranslationRetry, translationServiceFailure("翻译接口配置无效或请求未获许可")
	default:
		return "", translationRetryAfter(rateHeader, time.Now()),
			translationServiceFailure("翻译服务未能处理请求，请稍后重试")
	}
}

func translationRetryAfter(value string, now time.Time) time.Duration {
	value = strings.TrimSpace(value)
	if sec, err := strconv.ParseUint(value, 10, 64); err == nil {
		if sec > uint64(maxTranslationRetryDelay/time.Second) {
			return noTranslationRetry
		}
		return max(translationRetryDelay, time.Duration(sec)*time.Second)
	}
	if date, err := http.ParseTime(value); err == nil {
		wait := date.Sub(now)
		if wait > maxTranslationRetryDelay {
			return noTranslationRetry
		}
		return max(translationRetryDelay, wait)
	}
	return translationRetryDelay
}

func waitTranslationRetry(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return ctx.Err()
	}
}
