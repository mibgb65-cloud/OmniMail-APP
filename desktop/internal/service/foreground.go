package service

import (
	"context"
	"errors"
)

type foregroundLanes struct {
	body  chan struct{}
	flags chan struct{}
	users int
}

// 前台通道和后台额度隔离；每账号同类请求串行，正文和标记不共享 IMAP SELECT 状态。
func (s *Mail) acquireForeground(ctx context.Context, id string, flags bool) (func(), error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil, context.Canceled
	}
	if s.revoking[id] {
		s.mu.Unlock()
		return nil, errors.New("BUSY")
	}
	lanes := s.foreground[id]
	if lanes == nil {
		lanes = &foregroundLanes{body: make(chan struct{}, 1), flags: make(chan struct{}, 1)}
		s.foreground[id] = lanes
	}
	lane, pool := lanes.body, s.bodyNetwork
	if flags {
		lane, pool = lanes.flags, s.flagNetwork
	}
	s.mu.Unlock()
	select {
	case lane <- struct{}{}:
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-s.ctx.Done():
		return nil, context.Canceled
	}
	s.mu.Lock()
	if s.closed || s.revoking[id] || ctx.Err() != nil {
		s.mu.Unlock()
		<-lane
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		return nil, context.Canceled
	}
	lanes.users++
	s.mu.Unlock()
	releaseLane := func() { s.mu.Lock(); lanes.users--; s.mu.Unlock(); <-lane }
	select {
	case pool <- struct{}{}:
		return func() { <-pool; releaseLane() }, nil
	case <-ctx.Done():
		releaseLane()
		return nil, ctx.Err()
	case <-s.ctx.Done():
		releaseLane()
		return nil, context.Canceled
	}
}

// 撤销凭据必须仍与所有账号连接互斥，不能把同步解耦变成断开/重连的竞争窗口。
func (s *Mail) claimRevocation(id string) (func(), error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, context.Canceled
	}
	lanes := s.foreground[id]
	if s.active[id] || s.revoking[id] || (lanes != nil && lanes.users > 0) {
		return nil, errors.New("BUSY")
	}
	s.active[id], s.revoking[id] = true, true
	return func() { s.mu.Lock(); delete(s.active, id); delete(s.revoking, id); s.mu.Unlock() }, nil
}

func (s *Mail) flagVersion(id string) uint64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.flagEpoch[id]
}
