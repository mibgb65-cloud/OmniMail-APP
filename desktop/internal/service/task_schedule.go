package service

import (
	"context"
	"time"

	"omnimail/desktop/internal/domain"
)

func dailyTaskSlot(now time.Time, p domain.TaskPreferencesInput) (string, error) {
	location, err := time.LoadLocation(p.Timezone)
	if err != nil {
		return "", domain.ErrTaskInput
	}
	clock, err := time.Parse("15:04", p.Time)
	if err != nil {
		return "", domain.ErrTaskInput
	}
	local := now.In(location)
	due := time.Date(local.Year(), local.Month(), local.Day(), clock.Hour(), clock.Minute(), 0, 0, location)
	if local.Before(due) {
		due = due.AddDate(0, 0, -1)
	}
	// 只补最近到期日；未处理邮件由账本保留，不按停机天数重复发出多份任务。
	return due.Format("2006-01-02") + "@" + p.Timezone, nil
}

func (s *Tasks) Start() {
	s.mu.Lock()
	if s.started || s.closed {
		s.mu.Unlock()
		return
	}
	s.started = true
	// resources 在单实例检查前构造；只有真正获得运行权的 ApplicationStarted 才能恢复数据库任务。
	if !s.state.Running {
		recoverCtx, cancel := context.WithTimeout(s.ctx, 10*time.Second)
		err := s.store.RecoverTaskRuns(recoverCtx)
		cancel()
		if err != nil {
			s.state.Error = taskError(err)
			s.mu.Unlock()
			return
		}
	}
	s.wg.Add(1)
	s.mu.Unlock()
	go func() {
		defer s.wg.Done()
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			if err := s.tick(s.ctx, time.Now()); err != nil && s.ctx.Err() == nil {
				s.remember(err)
			}
			select {
			case <-s.ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func (s *Tasks) tick(ctx context.Context, now time.Time) error {
	s.mu.Lock()
	busy, closed := s.state.Running, s.closed
	s.mu.Unlock()
	if busy || closed {
		return nil
	}
	p, err := s.store.ReadTaskPreferences(ctx)
	if err != nil {
		return err
	}
	if !p.Consent {
		return nil
	}
	if err := s.guard(ctx, p); err != nil {
		return err
	}
	run, err := s.store.ResumableTaskRun(ctx, p.Revision, p.Enabled)
	if err != nil {
		return err
	}
	if run != nil {
		return s.Resume(ctx, run.ID)
	}
	if !p.Enabled {
		return nil
	}
	slot, err := dailyTaskSlot(now, p.TaskPreferencesInput)
	if err != nil {
		return err
	}
	_, err = s.createRun(ctx, p, "daily", slot, nil, false)
	return err
}

func (s *Mail) SyncForTasks(ctx context.Context, ids []string) error {
	accounts, err := s.store.ListAccounts(ctx)
	if err != nil {
		return domain.ErrTaskStorage
	}
	active := []string{}
	incomplete := false
	for _, id := range ids {
		found := false
		for _, account := range accounts {
			if account.ID != id {
				continue
			}
			found = true
			if account.Status != domain.AccountConfigured || !account.SyncEnabled {
				incomplete = true
				continue
			}
			if err := s.QueueSync(id); err != nil && ErrorCode(err) != "BUSY" {
				incomplete = true
				continue
			}
			active = append(active, id)
		}
		if !found {
			incomplete = true
		}
	}
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		ready := true
		s.mu.Lock()
		for _, id := range active {
			state := s.states[id]
			if state.ErrorCode != "" {
				incomplete = true
			}
			if state.Running || (state.More && state.ErrorCode == "") {
				ready = false
			}
		}
		s.mu.Unlock()
		if ready {
			if incomplete {
				return domain.ErrNetwork
			}
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}
