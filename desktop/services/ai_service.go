package services

import (
	"context"

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

func (s *AiService) GetCachedMailInsight(ctx context.Context, mailID string) (AiCachedStateDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return AiCachedStateDTO{}, err
	}
	ins, turns, err := s.gateway.ReadMailInsight(ctx, sess, mailID)
	if err != nil {
		return AiCachedStateDTO{}, err
	}
	if turns == nil {
		turns = []ai.AiChatTurn{}
	}
	return AiCachedStateDTO{Insight: ins, Turns: turns}, nil
}

func (s *AiService) SummarizeMail(ctx context.Context, mailID string, consentConfirmed, forceRefresh bool, options ai.MailSummaryOptions) (ai.AiMailInsight, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return ai.AiMailInsight{}, err
	}
	return s.gateway.SummarizeMail(ctx, sess, mailID, consentConfirmed, forceRefresh, options)
}

func (s *AiService) GenerateReplyDraft(ctx context.Context, mailID string, consentConfirmed bool, options ai.MailDraftOptions) (ai.AiMailInsight, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return ai.AiMailInsight{}, err
	}
	return s.gateway.GenerateReplyDraft(ctx, sess, mailID, consentConfirmed, options)
}

func (s *AiService) AskMailStream(req ai.AskMailRequest) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	return s.gateway.AskMailStream(sess, req)
}

func (s *AiService) TranslateMail(ctx context.Context, req ai.TranslateMailRequest) (ai.MailTranslation, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return ai.MailTranslation{}, err
	}
	return s.gateway.TranslateMail(ctx, sess, req)
}

func (s *AiService) TestTranslationConnection(ctx context.Context) (ai.TestResult, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return ai.TestResult{}, err
	}
	return s.gateway.TestTranslationConnection(ctx, sess)
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
