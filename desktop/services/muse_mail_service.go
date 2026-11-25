package services

import (
	"strings"
	"unicode/utf8"

	"omnimail/internal/apperr"
	"omnimail/internal/musemail"
	"omnimail/internal/profilemgr"
)

// MuseMailService 暴露独立于常规 IMAP/OAuth 体系的 Muse Mail 窄接口边界。
type MuseMailService struct {
	prof *profilemgr.Manager
	mgr  *musemail.Manager
}

func NewMuseMailService(prof *profilemgr.Manager, mgr *musemail.Manager) *MuseMailService {
	return &MuseMailService{prof: prof, mgr: mgr}
}

func (s *MuseMailService) GetStatus() (musemail.StatusDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return musemail.StatusDTO{LoginStage: "idle"}, nil
	}
	return s.mgr.GetStatus(sess), nil
}

func (s *MuseMailService) BeginConnect() (musemail.StatusDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return musemail.StatusDTO{LoginStage: "idle"}, err
	}
	return s.mgr.BeginConnect(sess)
}

func (s *MuseMailService) VerifyConnection() (musemail.VerifyResultDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return musemail.VerifyResultDTO{}, err
	}
	return s.mgr.VerifyConnection(sess)
}

func (s *MuseMailService) ConfirmConnection(accountName string) (musemail.StatusDTO, error) {
	trimmed := strings.TrimSpace(accountName)
	if utf8.RuneCountInString(trimmed) > 64 {
		return musemail.StatusDTO{LoginStage: "idle"}, apperr.New(apperr.CodeInvalidInput, "账户名称长度不能超过 64 个字符")
	}
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return musemail.StatusDTO{LoginStage: "idle"}, err
	}
	return s.mgr.ConfirmConnection(sess, trimmed)
}

func (s *MuseMailService) ListThreads(cursor string) (musemail.ThreadListDTO, error) {
	if len(cursor) > 128 {
		return musemail.ThreadListDTO{}, apperr.New(apperr.CodeInvalidInput, "分页游标格式无效")
	}
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return musemail.ThreadListDTO{}, err
	}
	return s.mgr.ListThreads(sess, cursor)
}

func (s *MuseMailService) GetThread(threadRef string) (musemail.ThreadDetailDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return musemail.ThreadDetailDTO{}, err
	}
	return s.mgr.GetThread(sess, threadRef)
}

func (s *MuseMailService) CancelRefresh() error {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return nil
	}
	s.mgr.CancelActiveRequests(sess)
	return nil
}

func (s *MuseMailService) Disconnect() (musemail.StatusDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return musemail.StatusDTO{LoginStage: "idle"}, nil
	}
	return s.mgr.Disconnect(sess), nil
}
