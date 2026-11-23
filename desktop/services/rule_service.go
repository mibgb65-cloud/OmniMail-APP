package services

import (
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/profilemgr"
	"omnimail/internal/rules"
	"omnimail/internal/search"
)

type RuleService struct {
	mgr *profilemgr.Manager
	bus *events.Bus
}

func NewRuleService(mgr *profilemgr.Manager, bus *events.Bus) *RuleService {
	return &RuleService{mgr: mgr, bus: bus}
}

func (s *RuleService) ListRules() ([]rules.InboxRuleDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return rules.ListRules(sess.DB)
}

func (s *RuleService) SaveRule(rule rules.InboxRuleDTO) (rules.InboxRuleDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return rules.InboxRuleDTO{}, err
	}
	return rules.SaveRule(sess.DB, rule)
}

func (s *RuleService) DeleteRule(id string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	return rules.DeleteRule(sess.DB, id)
}

func (s *RuleService) ReorderRules(ids []string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	return rules.ReorderRules(sess.DB, ids)
}

func (s *RuleService) PreviewRule(rule rules.InboxRuleDTO) (rules.RulePreviewResult, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return rules.RulePreviewResult{}, err
	}
	return rules.PreviewRule(sess.DB, rule)
}

func (s *RuleService) RunRuleNow(ruleID string) (int, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return 0, err
	}
	hit, err := rules.RunRuleNow(sess.DB, ruleID)
	if err == nil && hit > 0 && s.bus != nil {
		counts, _ := search.GetFolderCounts(sess.DB, "")
		s.bus.Emit(events.MailDelta, events.MailDeltaPayload{FolderCounts: counts.Counts})
	}
	return hit, err
}

func (s *RuleService) GetAutoReplyConfig() (config.AutoReplyConfig, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return config.AutoReplyConfig{}, err
	}
	settings := config.LoadProfileSettings(sess.ProfileDir)
	return settings.AutoReply, nil
}

func (s *RuleService) SaveAutoReplyConfig(cfg config.AutoReplyConfig) (config.AutoReplyConfig, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return config.AutoReplyConfig{}, err
	}
	settings := config.LoadProfileSettings(sess.ProfileDir)
	settings.AutoReply = cfg
	if err := config.SaveProfileSettings(sess.ProfileDir, settings); err != nil {
		return config.AutoReplyConfig{}, err
	}
	return settings.AutoReply, nil
}
