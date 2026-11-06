package service

import (
	"context"
	"crypto/rand"
	"errors"
	"slices"
	"sort"
	"sync"
	_ "time/tzdata"

	"omnimail/desktop/internal/domain"
)

type TaskState struct {
	Running bool   `json:"running"`
	RunID   string `json:"runId"`
	Error   string `json:"error"`
}
type Tasks struct {
	store           domain.TaskRepository
	ai              *AI
	provider        domain.RequirementProvider
	syncMail        func(context.Context, []string) error
	ctx             context.Context
	cancel          context.CancelFunc
	mu              sync.Mutex
	wg              sync.WaitGroup
	started, closed bool
	state           TaskState
	activeCancel    context.CancelFunc
	stopped         bool
}

func NewTasks(store domain.TaskRepository, ai *AI, provider domain.RequirementProvider, syncMail func(context.Context, []string) error) (*Tasks, error) {
	ctx, cancel := context.WithCancel(context.Background())
	if store == nil || ai == nil || provider == nil {
		cancel()
		return nil, domain.ErrTaskInput
	}
	return &Tasks{store: store, ai: ai, provider: provider, syncMail: syncMail, ctx: ctx, cancel: cancel}, nil
}

func (s *Tasks) State() TaskState { s.mu.Lock(); defer s.mu.Unlock(); return s.state }
func (s *Tasks) Preferences(ctx context.Context) (domain.TaskPreferences, error) {
	return s.store.ReadTaskPreferences(ctx)
}
func (s *Tasks) SavePreferences(ctx context.Context, input domain.TaskPreferencesInput) (domain.TaskPreferences, error) {
	if input.Validate() != nil {
		return domain.TaskPreferences{}, domain.ErrTaskInput
	}
	input.Accounts = append([]string(nil), input.Accounts...)
	input.Folders = append([]string(nil), input.Folders...)
	sort.Strings(input.Accounts)
	sort.Strings(input.Folders)
	config, err := s.ai.Config(ctx)
	if err != nil {
		return domain.TaskPreferences{}, err
	}
	if input.Consent && (config.Endpoint == "" || !config.Consent) {
		return domain.TaskPreferences{}, domain.ErrAIConsent
	}
	value := domain.TaskPreferences{TaskPreferencesInput: input, Revision: rand.Text(), AIRevision: config.Revision}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return value, context.Canceled
	}
	stored, err := s.store.ReadTaskPreferences(ctx)
	if err != nil {
		return domain.TaskPreferences{}, err
	}
	old := stored.TaskPreferencesInput
	if stored.Revision != "" && stored.AIRevision == config.Revision && old.Enabled == input.Enabled && old.Consent == input.Consent &&
		old.Time == input.Time && old.Timezone == input.Timezone && old.Limit == input.Limit &&
		slices.Equal(old.Accounts, input.Accounts) && slices.Equal(old.Folders, input.Folders) {
		// 重复保存不是重新授权或停止命令；保留修订与在途任务，避免无意义取消/未知计费。
		return stored, nil
	}
	if s.activeCancel != nil {
		s.stopped = true
		s.activeCancel()
	}
	if err := s.store.WriteTaskPreferences(ctx, value); err != nil {
		return domain.TaskPreferences{}, err
	}
	s.state.Error = ""
	return value, nil
}

func (s *Tasks) guard(ctx context.Context, expected domain.TaskPreferences) error {
	current, err := s.store.ReadTaskPreferences(ctx)
	if err != nil {
		return err
	}
	if !current.Consent {
		return domain.ErrTaskConsent
	}
	if current.Revision != expected.Revision {
		return domain.ErrTaskConfig
	}
	config, err := s.ai.Config(ctx)
	if err != nil {
		return err
	}
	if config.Revision != current.AIRevision {
		return domain.ErrTaskConfig
	}
	if !config.Consent || config.Endpoint == "" {
		return domain.ErrAIConsent
	}
	return ctx.Err()
}

func (s *Tasks) RunBatch(ctx context.Context, input domain.TaskBatchInput) (string, error) {
	p, err := s.checkBatch(ctx, input)
	if err != nil {
		return "", err
	}
	return s.createRun(ctx, p, "manual", "", input.MailIDs, input.RetryUnknown)
}
func (s *Tasks) CheckBatch(ctx context.Context, input domain.TaskBatchInput) error {
	_, err := s.checkBatch(ctx, input)
	return err
}
func (s *Tasks) checkBatch(ctx context.Context, input domain.TaskBatchInput) (domain.TaskPreferences, error) {
	p, err := s.store.ReadTaskPreferences(ctx)
	if err != nil {
		return p, err
	}
	if len(input.MailIDs) < 1 || len(input.MailIDs) > p.Limit {
		return p, domain.ErrTaskInput
	}
	if err := s.guard(ctx, p); err != nil {
		return p, err
	}
	seen := map[string]bool{}
	for _, id := range input.MailIDs {
		if !domain.ValidAccountID(id) || seen[id] {
			return p, domain.ErrTaskInput
		}
		seen[id] = true
		mail, err := s.store.ReadTaskMail(ctx, id)
		if err != nil {
			return p, err
		}
		if !p.Allows(mail.AccountID, mail.Folder) {
			return p, domain.ErrTaskConsent
		}
		if _, err := translationText(mail.MailDetail); err != nil {
			if errors.Is(err, domain.ErrTranslationTooLarge) {
				return p, domain.ErrAITooLarge
			}
			return p, domain.ErrAINotReady
		}
	}
	return p, nil
}

func (s *Tasks) RunPending(ctx context.Context) (string, error) {
	p, err := s.store.ReadTaskPreferences(ctx)
	if err != nil {
		return "", err
	}
	if err := s.guard(ctx, p); err != nil {
		return "", err
	}
	return s.createRun(ctx, p, "manual", "", nil, false)
}
func (s *Tasks) createRun(ctx context.Context, p domain.TaskPreferences, kind, slot string, ids []string, retry bool) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return "", context.Canceled
	}
	if s.state.Running {
		return "", domain.ErrTaskBusy
	}
	run, created, err := s.store.CreateTaskRun(ctx, kind, slot, p.Revision, ids, retry, 0, 0)
	if err != nil {
		return "", err
	}
	if created {
		s.launchLocked(run, p)
	}
	return run.ID, nil
}
func (s *Tasks) launchLocked(run domain.TaskRun, p domain.TaskPreferences) {
	ctx, cancel := context.WithCancel(s.ctx)
	s.activeCancel = cancel
	s.stopped = false
	s.state = TaskState{Running: true, RunID: run.ID}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer func() { cancel(); s.mu.Lock(); s.state.Running = false; s.activeCancel = nil; s.mu.Unlock() }()
		s.work(ctx, run, p)
	}()
}
func (s *Tasks) Resume(ctx context.Context, id string) error {
	p, err := s.store.ReadTaskPreferences(ctx)
	if err != nil {
		return err
	}
	if err := s.guard(ctx, p); err != nil {
		return err
	}
	details, err := s.store.TaskRunDetails(ctx, id)
	if err != nil {
		return err
	}
	if details.Run.PrefsRevision != p.Revision {
		return domain.ErrTaskConfig
	}
	if details.Run.Pending == 0 && !details.Run.SyncPending {
		return domain.ErrTaskInput
	}
	if details.Run.Kind == "daily" && !p.Enabled {
		return domain.ErrTaskConsent
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return context.Canceled
	}
	if s.state.Running {
		return domain.ErrTaskBusy
	}
	if err := s.store.MarkTaskRunning(ctx, id); err != nil {
		return err
	}
	s.launchLocked(details.Run, p)
	return nil
}
func (s *Tasks) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stopped = true
	if s.activeCancel != nil {
		s.activeCancel()
	}
}
func (s *Tasks) Close() { s.mu.Lock(); s.closed = true; s.cancel(); s.mu.Unlock(); s.wg.Wait() }

func taskError(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, context.Canceled) {
		return "AI_CANCELED"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "AI_TIMEOUT"
	}
	for _, known := range []error{domain.ErrTaskInput, domain.ErrTaskConflict, domain.ErrTaskNotFound, domain.ErrTaskConsent, domain.ErrTaskConfig,
		domain.ErrTaskBusy, domain.ErrTaskUnknown, domain.ErrTaskStorage, domain.ErrTaskLimit, domain.ErrAIBusy, domain.ErrAIConsent, domain.ErrAIConfig,
		domain.ErrAIInput, domain.ErrAIUnavailable, domain.ErrAIResponse, domain.ErrAIRate, domain.ErrAIStorage, domain.ErrAITooLarge, domain.ErrAINotReady} {
		if errors.Is(err, known) {
			return known.Error()
		}
	}
	return domain.ErrTaskStorage.Error()
}
