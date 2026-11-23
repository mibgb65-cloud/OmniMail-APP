package services

import (
	"omnimail/internal/ai"
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
