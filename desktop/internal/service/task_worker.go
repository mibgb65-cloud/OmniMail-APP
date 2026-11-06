package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

func (s *Tasks) work(ctx context.Context, run domain.TaskRun, p domain.TaskPreferences) {
	if run.SyncPending {
		incomplete := false
		if s.syncMail != nil {
			syncCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
			err := s.syncMail(syncCtx, p.Accounts)
			cancel()
			if ctx.Err() != nil {
				s.endRun(run.ID, "", ctx.Err())
				return
			}
			incomplete = err != nil
		}
		if err := s.guard(ctx, p); err != nil {
			s.endRun(run.ID, "failed", err)
			return
		}
		ids, waiting, remaining, err := s.store.PendingTaskMails(ctx, p)
		if err != nil {
			s.endRun(run.ID, "failed", err)
			return
		}
		if err := s.store.FillTaskRun(ctx, run.ID, ids, waiting, remaining, incomplete); err != nil {
			s.endRun(run.ID, "failed", err)
			return
		}
	}
	for {
		if ctx.Err() != nil {
			s.endRun(run.ID, "", ctx.Err())
			return
		}
		if err := s.guard(ctx, p); err != nil {
			s.endRun(run.ID, "failed", err)
			return
		}
		mail, found, err := s.store.NextTaskMail(ctx, run.ID)
		if err != nil {
			s.endRun(run.ID, "failed", err)
			return
		}
		if !found {
			s.endRun(run.ID, "", nil)
			return
		}
		attempted, err := s.process(ctx, run, p, mail.MailID)
		if !attempted && (errors.Is(err, domain.ErrAIBusy) || errors.Is(err, domain.ErrAIRate)) {
			// 等待本机额度时尚未外发，保留队列和可停止状态，不能当作失败消耗邮件。
			timer := time.NewTimer(5 * time.Second)
			select {
			case <-ctx.Done():
				timer.Stop()
				s.endRun(run.ID, "", ctx.Err())
				return
			case <-timer.C:
			}
			continue
		}
		if err != nil {
			cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			writeErr := s.store.FailTaskMail(cleanup, run.ID, mail.MailID, taskError(err), attempted)
			cancel()
			if writeErr != nil {
				s.remember(writeErr)
				s.endRun(run.ID, "failed", writeErr)
				return
			}
			if ctx.Err() != nil {
				s.endRun(run.ID, "", ctx.Err())
				return
			}
			if attempted || errors.Is(err, domain.ErrTaskConsent) || errors.Is(err, domain.ErrTaskConfig) || errors.Is(err, domain.ErrAIStorage) || errors.Is(err, domain.ErrTaskStorage) {
				s.endRun(run.ID, "partial", err)
				return
			}
		}
		// 每封之间主动留出前台交互窗口；不抢占正在进行的 HTTP 请求。
		timer := time.NewTimer(200 * time.Millisecond)
		select {
		case <-ctx.Done():
			timer.Stop()
			s.endRun(run.ID, "", ctx.Err())
			return
		case <-timer.C:
		}
	}
}

func (s *Tasks) process(ctx context.Context, run domain.TaskRun, p domain.TaskPreferences, id string) (bool, error) {
	mail, err := s.store.ReadTaskMail(ctx, id)
	if err != nil {
		return false, err
	}
	if !p.Allows(mail.AccountID, mail.Folder) {
		return false, domain.ErrTaskConsent
	}
	text, err := translationText(mail.MailDetail)
	if err != nil {
		if errors.Is(err, domain.ErrTranslationTooLarge) {
			return false, domain.ErrAITooLarge
		}
		return false, domain.ErrAINotReady
	}
	candidates, err := s.store.RequirementCandidates(ctx, p, mail)
	if err != nil {
		return false, err
	}
	input := domain.RequirementInput{Source: text, Candidates: candidates}
	fingerprint, err := requirementFingerprint(mail, text)
	if err != nil {
		return false, err
	}
	output, attempted, err := s.ai.extractRequirements(ctx, s.provider, id, p.AIRevision, input, func(callCtx context.Context) (bool, error) {
		if err := s.guard(callCtx, p); err != nil {
			return false, err
		}
		return s.store.ReserveTaskMail(callCtx, run.ID, mail, fingerprint, run.RetryUnknown)
	})
	if err != nil || !attempted {
		return attempted, err
	}
	if err := s.guard(ctx, p); err != nil {
		return true, err
	}
	return true, s.store.CommitRequirements(ctx, run.ID, mail, fingerprint, input, output)
}

func requirementFingerprint(mail domain.TaskMail, text domain.TranslatedText) (string, error) {
	raw, err := json.Marshal(struct {
		Account, MessageID, From, To, Format string
		ReceivedAt                           int64
		Text                                 domain.TranslatedText
	}{mail.AccountID, mail.MessageID, mail.From, mail.To, domain.RequirementFormat, mail.ReceivedAt, text})
	if err != nil {
		return "", domain.ErrTaskInput
	}
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:]), nil
}

func (s *Tasks) remember(err error) { s.mu.Lock(); s.state.Error = taskError(err); s.mu.Unlock() }
func (s *Tasks) endRun(id, state string, cause error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	code := taskError(cause)
	if errors.Is(cause, context.Canceled) {
		s.mu.Lock()
		stopped := s.stopped
		s.mu.Unlock()
		state = "interrupted"
		if stopped {
			state = "cancelled"
		}
	}
	if state == "" {
		details, err := s.store.TaskRunDetails(ctx, id)
		if err != nil {
			s.remember(err)
			return
		}
		state = "success"
		if details.Run.Pending+details.Run.Failed+details.Run.Unknown+details.Run.WaitingBody+details.Run.Remaining > 0 || details.Run.Error != "" {
			state = "partial"
		}
		if code == "" {
			code = details.Run.Error
		}
	}
	if err := s.store.FinishTaskRun(ctx, id, state, code); err != nil {
		s.remember(err)
	}
}
