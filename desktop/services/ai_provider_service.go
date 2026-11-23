package services

import (
	"context"
	"strings"

	"omnimail/internal/ai"
	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
)

func (s *AiService) SaveAiProviderConfig(req ai.SaveConfigRequest) (config.AppSettings, error) {
	sess, cfg, err := s.resolveAiConfig(ai.ProviderConfig(req), true)
	if err != nil {
		return config.AppSettings{}, err
	}
	if config.AiPresetBaseURL(cfg.Provider) != "" && cfg.APIKey == "" {
		return config.AppSettings{}, apperr.New(apperr.CodeInvalidInput, "请先填写此服务提供方的 API 密钥")
	}
	if strings.TrimSpace(req.APIKey) != "" {
		if sess.Vault == nil || sess.Vault.Set(config.AiVaultKey(cfg.Provider, cfg.BaseURL), cfg.APIKey) != nil {
			return config.AppSettings{}, apperr.New(apperr.CodeInternal, "无法写入当前空间的加密凭据盒")
		}
	}
	return s.mgr.UpdateSessionSettings(sess, config.AppSettingsPatch{
		AiProvider: &cfg.Provider,
		AiModel:    &cfg.Model,
		AiBaseURL:  &cfg.BaseURL,
	})
}

func (s *AiService) GetAiApiKeyMask(provider, baseURL string) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	provider, baseURL, err = config.ResolveAiEndpoint(provider, baseURL)
	if err != nil || sess.Vault == nil {
		return "", err
	}
	key, _ := sess.Vault.Get(config.AiVaultKey(provider, baseURL))
	return security.MaskSecret(key), nil
}

func (s *AiService) ClearAiApiKey(provider, baseURL string) (config.AppSettings, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return config.AppSettings{}, err
	}
	provider, baseURL, err = config.ResolveAiEndpoint(provider, baseURL)
	if err != nil {
		return config.AppSettings{}, err
	}
	if sess.Vault != nil && sess.Vault.Delete(config.AiVaultKey(provider, baseURL)) != nil {
		return config.AppSettings{}, apperr.New(apperr.CodeInternal, "无法清除当前空间的加密密钥")
	}
	if sess.Ctx.Err() != nil {
		return config.AppSettings{}, apperr.New(apperr.CodeInvalidInput, "活动空间已切换，请重新打开设置")
	}
	return s.mgr.GetAppSettings()
}

func (s *AiService) FetchAiModels(ctx context.Context, req ai.ModelsRequest) ([]string, error) {
	sess, cfg, err := s.resolveAiConfig(ai.ProviderConfig{
		Provider: req.Provider, BaseURL: req.BaseURL, APIKey: req.APIKey,
	}, false)
	if err != nil {
		return nil, err
	}
	ctx, cancel := aiSessionContext(ctx, sess)
	defer cancel()
	return ai.FetchProviderModels(ctx, cfg)
}

func (s *AiService) TestAiConnection(ctx context.Context, req ai.SaveConfigRequest) (ai.TestResult, error) {
	sess, cfg, err := s.resolveAiConfig(ai.ProviderConfig(req), true)
	if err != nil {
		return ai.TestResult{}, err
	}
	ctx, cancel := aiSessionContext(ctx, sess)
	defer cancel()
	return ai.TestProvider(ctx, cfg)
}

func (s *AiService) resolveAiConfig(input ai.ProviderConfig, requireModel bool) (*profilemgr.Session, ai.ProviderConfig, error) {
	cfg, err := ai.NormalizeProviderConfig(input, requireModel)
	if err != nil {
		return nil, ai.ProviderConfig{}, err
	}
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, ai.ProviderConfig{}, err
	}
	if cfg.APIKey == "" && sess.Vault != nil {
		cfg.APIKey, _ = sess.Vault.Get(config.AiVaultKey(cfg.Provider, cfg.BaseURL))
		cfg, err = ai.NormalizeProviderConfig(cfg, requireModel)
	}
	return sess, cfg, err
}

func aiSessionContext(ctx context.Context, sess *profilemgr.Session) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(ctx)
	stop := context.AfterFunc(sess.Ctx, cancel)
	return ctx, func() {
		stop()
		cancel()
	}
}
