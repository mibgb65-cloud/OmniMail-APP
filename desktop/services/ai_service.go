package services

import (
	"strings"

	"omnimail/internal/ai"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

type AiCachedStateDTO struct {
	Insight *ai.AiMailInsight `json:"insight,omitempty"`
	Turns   []ai.AiChatTurn   `json:"turns"`
}

type AiService struct {
	mgr     *profilemgr.Manager
	gateway *ai.Gateway
}

func NewAiService(mgr *profilemgr.Manager, gateway *ai.Gateway) *AiService {
	return &AiService{mgr: mgr, gateway: gateway}
}

func (s *AiService) SaveAiProviderConfig(req ai.SaveConfigRequest) (config.AppSettings, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return config.AppSettings{}, err
	}
	prov := strings.ToLower(strings.TrimSpace(req.Provider))
	if prov == "" {
		prov = "openai"
	}
	if strings.TrimSpace(req.APIKey) != "" && sess.Vault != nil {
		if err := sess.Vault.Set(ai.VaultAiKey(prov), strings.TrimSpace(req.APIKey)); err != nil {
			return config.AppSettings{}, err
		}
	}
	model := strings.TrimSpace(req.Model)
	baseURL := strings.TrimSpace(req.BaseURL)
	return s.mgr.UpdateAppSettings(config.AppSettingsPatch{
		AiProvider: &prov,
		AiModel:    &model,
		AiBaseURL:  &baseURL,
	})
}

func (s *AiService) ClearAiApiKey(provider string) (config.AppSettings, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return config.AppSettings{}, err
	}
	prov := strings.ToLower(strings.TrimSpace(provider))
	if prov == "" {
		cur := config.LoadProfileSettings(sess.ProfileDir)
		prov = cur.AiProvider
	}
	if sess.Vault != nil {
		_ = sess.Vault.Delete(ai.VaultAiKey(prov))
	}
	return s.mgr.GetAppSettings()
}

func (s *AiService) TestAiConnection() (ai.TestResult, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return ai.TestResult{}, err
	}
	settings := config.LoadProfileSettings(sess.ProfileDir)
	var apiKey string
	if sess.Vault != nil {
		apiKey, _ = sess.Vault.Get(ai.VaultAiKey(settings.AiProvider))
	}
	return ai.TestProvider(sess.Ctx, ai.ProviderConfig{
		Provider: settings.AiProvider,
		Model:    settings.AiModel,
		BaseURL:  settings.AiBaseURL,
		APIKey:   apiKey,
	})
}

func (s *AiService) GetCachedMailInsight(mailID string) (AiCachedStateDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return AiCachedStateDTO{}, err
	}
	ins, turns := s.gateway.GetCachedInsight(sess.DB, mailID)
	if turns == nil {
		turns = []ai.AiChatTurn{}
	}
	return AiCachedStateDTO{Insight: ins, Turns: turns}, nil
}

func (s *AiService) AnalyzeMail(mailID string, consentConfirmed bool, forceRefresh bool) (ai.AiMailInsight, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return ai.AiMailInsight{}, err
	}
	return s.gateway.AnalyzeMail(sess, mailID, consentConfirmed, forceRefresh)
}

func (s *AiService) AskMailStream(req ai.AskMailRequest) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	return s.gateway.AskMailStream(sess, req)
}

func (s *AiService) AssistComposeStream(req ai.ComposeAssistRequest) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	return s.gateway.AssistComposeStream(sess, req)
}

func (s *AiService) CancelAiRequest(requestID string) error {
	s.gateway.CancelRequest(requestID)
	return nil
}
