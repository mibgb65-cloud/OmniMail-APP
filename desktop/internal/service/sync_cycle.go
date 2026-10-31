package service

import (
	"context"
	"time"

	"omnimail/desktop/internal/domain"
)

const syncBatchReserve = 20 * time.Second

func syncShouldYield(ctx context.Context) bool {
	deadline, ok := ctx.Deadline()
	return ctx.Err() == nil && ok && time.Until(deadline) <= syncBatchReserve
}

func (s *Mail) syncMailboxes(ctx context.Context, id string, boxes []domain.RemoteMailbox, session domain.MailSession) (bool, error) {
	ctx = bodySyncContext(ctx)
	s.mu.Lock()
	completed := make(map[string]bool, len(boxes))
	for _, box := range boxes {
		if s.cycles[id][box.Name] {
			completed[box.Name] = true
		}
	}
	// 只保留本次 LIST 中的名称，避免远端持续改名使周期内存提示无限增长。
	s.cycles[id] = completed
	s.mu.Unlock()
	more := false
	for _, box := range boxes {
		if err := ctx.Err(); err != nil {
			return more, err
		}
		if completed[box.Name] {
			continue
		}
		if syncShouldYield(ctx) || bodyBudget(ctx).count > 0 {
			return true, nil
		}
		pending, err := s.syncMailbox(ctx, id, box, session)
		if err != nil {
			return true, err
		}
		if !pending {
			// 同账号已有互斥；本周期完成的文件夹不因下一轮续排再次从头重对账。
			completed[box.Name] = true
		}
		more = more || pending
	}
	if !more {
		s.mu.Lock()
		delete(s.cycles, id)
		s.mu.Unlock()
	}
	return more, nil
}

func (s *Mail) resumeSync(id string) {
	s.mu.Lock()
	delete(s.pending, id)
	state := s.states[id]
	resume := !s.closed && state.More && state.ErrorCode == ""
	busy := s.active[id]
	s.mu.Unlock()
	if !resume {
		return
	}
	if busy {
		// 正文/手动同步可能临时占用账号；继续等下一轮，不丢弃历史同步的续排。
		s.continueSync(id)
		return
	}
	if err := s.queueSync(id, true); err != nil {
		if ErrorCode(err) == "BUSY" {
			s.continueSync(id)
		} else if s.ctx.Err() == nil {
			s.log.Warn("继续历史同步失败", "code", ErrorCode(err))
		}
	}
}
