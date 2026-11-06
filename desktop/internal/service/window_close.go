package service

import (
	"context"
	"errors"
	"sync"

	"omnimail/desktop/internal/domain"
)

type WindowCloseState struct {
	Mode                string `json:"mode"`
	Pending             bool   `json:"pending"`
	BackgroundAvailable bool   `json:"backgroundAvailable"`
}

type WindowCloseEffects struct {
	Hide   func()
	Quit   func()
	Notify func()
}

type WindowLifecycle struct {
	mu       sync.Mutex
	store    domain.ClosePreferences
	effects  WindowCloseEffects
	state    WindowCloseState
	busy     bool
	quitting bool
}

func NewWindowLifecycle(ctx context.Context, store domain.ClosePreferences, effects WindowCloseEffects, background bool) (*WindowLifecycle, error) {
	mode, err := store.Load(ctx)
	if err != nil || !domain.ValidCloseMode(mode) {
		mode = domain.CloseAsk
		if err == nil {
			err = errors.New("关闭偏好无效，已恢复每次询问")
		}
	}
	if mode == domain.CloseBackground && !background {
		mode = domain.CloseAsk
	}
	return &WindowLifecycle{store: store, effects: effects,
		state: WindowCloseState{Mode: mode, BackgroundAvailable: background}}, err
}

func (s *WindowLifecycle) State(ctx context.Context) (WindowCloseState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state, ctx.Err()
}

func (s *WindowLifecycle) SetMode(ctx context.Context, mode string) error {
	s.mu.Lock()
	if err := s.validate(ctx, mode); err != nil {
		s.mu.Unlock()
		return err
	}
	if s.state.Pending || s.busy || s.quitting {
		s.mu.Unlock()
		return errors.New("请先完成当前关闭操作")
	}
	if err := s.store.Save(ctx, mode); err != nil {
		s.mu.Unlock()
		return errors.New("无法保存关闭偏好，请重试")
	}
	s.state.Mode = mode
	s.mu.Unlock()
	s.effects.Notify()
	return nil
}

// RequestClose 统一处理标题栏与 Alt+F4；原生适配层始终先取消默认销毁。
func (s *WindowLifecycle) RequestClose() {
	s.mu.Lock()
	if s.busy || s.quitting {
		s.mu.Unlock()
		return
	}
	if s.state.Pending {
		s.mu.Unlock()
		// 前端尚未就绪或上次 IPC 读取失败时，下一次关闭可重新同步同一个请求。
		s.effects.Notify()
		return
	}
	mode := s.state.Mode
	if mode == domain.CloseAsk {
		s.state.Pending = true
		s.mu.Unlock()
		s.effects.Notify()
		return
	}
	s.busy = true
	s.mu.Unlock()
	s.execute(mode)
}

func (s *WindowLifecycle) Resolve(ctx context.Context, mode string, remember bool) error {
	s.mu.Lock()
	if err := s.validate(ctx, mode); err != nil {
		s.mu.Unlock()
		return err
	}
	if mode == domain.CloseAsk || !s.state.Pending || s.busy {
		s.mu.Unlock()
		return errors.New("没有待确认的关闭操作")
	}
	// 必须保存成功后才隐藏/退出；失败保留本次请求，不能把未保存伪装成默认已设置。
	if remember {
		if err := s.store.Save(ctx, mode); err != nil {
			s.mu.Unlock()
			return errors.New("无法保存关闭偏好，请重试或取消记住选择")
		}
		s.state.Mode = mode
	}
	s.state.Pending, s.busy = false, true
	s.mu.Unlock()
	s.execute(mode)
	return nil
}

func (s *WindowLifecycle) Cancel(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	s.state.Pending = false
	s.mu.Unlock()
	s.effects.Notify()
	return nil
}

func (s *WindowLifecycle) validate(ctx context.Context, mode string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !domain.ValidCloseMode(mode) {
		return errors.New("关闭行为无效")
	}
	if mode == domain.CloseBackground && !s.state.BackgroundAvailable {
		return errors.New("当前平台暂不支持后台运行")
	}
	return nil
}

func (s *WindowLifecycle) execute(mode string) {
	if mode == domain.CloseQuit {
		s.mu.Lock()
		s.quitting = true
		s.mu.Unlock()
		s.effects.Quit()
	} else {
		s.effects.Hide()
	}
	s.mu.Lock()
	s.busy = false
	s.mu.Unlock()
	s.effects.Notify()
}
