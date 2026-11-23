package services

import (
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/outbox"
	"omnimail/internal/profilemgr"
	"omnimail/internal/search"
)

type ComposeService struct {
	mgr       *profilemgr.Manager
	scheduler *outbox.Scheduler
	bus       *events.Bus
}

func NewComposeService(mgr *profilemgr.Manager, scheduler *outbox.Scheduler, bus *events.Bus) *ComposeService {
	return &ComposeService{mgr: mgr, scheduler: scheduler, bus: bus}
}

func (s *ComposeService) CreateDraft(req outbox.CreateDraftRequest) (outbox.ComposeDraftState, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return outbox.ComposeDraftState{}, err
	}
	settings := config.LoadProfileSettings(sess.ProfileDir)
	d, err := outbox.CreateDraft(sess.DB, settings, req)
	if err == nil {
		s.emitDraftCounts(sess, d.AccountID)
	}
	return d, err
}

func (s *ComposeService) SaveDraft(draft outbox.ComposeDraftState) (outbox.ComposeDraftState, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return outbox.ComposeDraftState{}, err
	}
	d, err := outbox.SaveDraft(sess.DB, draft)
	if err == nil {
		s.emitDraftCounts(sess, d.AccountID)
	}
	return d, err
}

func (s *ComposeService) GetDraft(draftID string) (outbox.ComposeDraftState, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return outbox.ComposeDraftState{}, err
	}
	return outbox.GetDraft(sess.DB, draftID)
}

func (s *ComposeService) ListDrafts() ([]outbox.ComposeDraftState, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return outbox.ListDrafts(sess.DB)
}

func (s *ComposeService) DeleteDraft(draftID string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	err = outbox.DeleteDraft(sess.DB, draftID)
	if err == nil {
		s.emitDraftCounts(sess, "")
	}
	return err
}

func (s *ComposeService) SendDraft(req outbox.SendDraftRequest) (outbox.OutboxJobDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return outbox.OutboxJobDTO{}, err
	}
	return s.scheduler.SendDraft(sess, req)
}

func (s *ComposeService) UndoSend(jobID string) (outbox.ComposeDraftState, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return outbox.ComposeDraftState{}, err
	}
	return s.scheduler.UndoSend(sess, jobID)
}

func (s *ComposeService) SendNow(jobID string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	return s.scheduler.SendNow(sess, jobID)
}

func (s *ComposeService) ListOutboxJobs(filter string) ([]outbox.OutboxJobDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return outbox.ListJobs(sess.DB, filter)
}

func (s *ComposeService) RetryOutboxJob(jobID string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	return s.scheduler.RetryJob(sess, jobID)
}

func (s *ComposeService) CancelOutboxJob(jobID string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	return s.scheduler.CancelJob(sess, jobID)
}

func (s *ComposeService) emitDraftCounts(sess *profilemgr.Session, accountID string) {
	if s.bus == nil {
		return
	}
	counts, _ := search.GetFolderCounts(sess.DB, "")
	s.bus.Emit(events.MailDelta, events.MailDeltaPayload{
		AccountID:    accountID,
		FolderCounts: counts.Counts,
	})
}
