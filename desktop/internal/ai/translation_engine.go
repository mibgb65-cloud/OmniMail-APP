package ai

import (
	"context"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

type translationBatchFunc func(context.Context, string, string, []string) (string, []string, error)

func mailTranslationEngine(sess *profilemgr.Session, settings config.AppSettings) (translationBatchFunc, error) {
	if !settings.TranslationEnabled {
		return nil, apperr.New(apperr.CodeAiDisabled, "邮件翻译已停用，请前往翻译设置开启")
	}
	switch settings.TranslationProvider {
	case config.TranslationProviderFree:
		endpoint, err := freeTranslationEndpoint(settings.TranslationEndpoint)
		if err != nil {
			return nil, err
		}
		return freeTranslationBatch(endpoint, time.Duration(settings.TranslationTimeoutSec)*time.Second), nil
	case config.TranslationProviderAI:
		if !settings.AiEnabled {
			return nil, apperr.New(apperr.CodeAiDisabled, "请先在 AI 助手设置中启用并配置模型，或切换翻译引擎")
		}
		cfg := resolveProviderConfig(sess, settings)
		return func(ctx context.Context, source, target string, segments []string) (string, []string, error) {
			return translateTextBatch(ctx, cfg, source, target, segments)
		}, nil
	default:
		return nil, apperr.New(apperr.CodeInvalidInput, "未配置有效的翻译引擎")
	}
}

func (g *Gateway) TestTranslationConnection(ctx context.Context, sess *profilemgr.Session) (TestResult, error) {
	start := time.Now()
	settings := config.LoadProfileSettings(sess.ProfileDir)
	engine, err := mailTranslationEngine(sess, settings)
	if err != nil {
		return TestResult{}, err
	}
	// 允许两个最长 30 秒的请求和最多 3 秒的退避。
	testCtx, cancel := context.WithTimeout(ctx, 64*time.Second)
	stop := context.AfterFunc(sess.Ctx, cancel)
	defer stop()
	defer cancel()
	// 测试始终使用固定样例，不读取邮件或缓存。
	_, _, err = engine(testCtx, "en", "zh-CN", []string{"Hello, world."})
	ms := time.Since(start).Milliseconds()
	if err != nil {
		return TestResult{Status: "error", LatencyMs: ms, Message: err.Error()}, nil
	}
	return TestResult{OK: true, Status: "idle", LatencyMs: ms, Message: "接口连通正常"}, nil
}
