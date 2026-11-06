package service

import (
	"context"
	"errors"
	"sync"
	"testing"

	"omnimail/desktop/internal/domain"
)

type closeStore struct {
	mode  string
	err   error
	saves int
}

func (p *closeStore) Load(context.Context) (string, error) { return p.mode, p.err }
func (p *closeStore) Save(_ context.Context, value string) error {
	if p.err != nil {
		return p.err
	}
	p.mode, p.saves = value, p.saves+1
	return nil
}

func closeFixture(t *testing.T, background bool) (*WindowLifecycle, *closeStore, *int, *int, *int) {
	t.Helper()
	store := &closeStore{mode: domain.CloseAsk}
	hide, quit, notify := 0, 0, 0
	service, err := NewWindowLifecycle(t.Context(), store, WindowCloseEffects{
		Hide: func() { hide++ }, Quit: func() { quit++ }, Notify: func() { notify++ },
	}, background)
	if err != nil {
		t.Fatal(err)
	}
	return service, store, &hide, &quit, &notify
}

func TestWindowCloseAskCancelAndOneShot(t *testing.T) {
	service, store, hide, quit, notify := closeFixture(t, true)
	service.RequestClose()
	service.RequestClose()
	state, _ := service.State(t.Context())
	if !state.Pending || *hide != 0 || *quit != 0 || *notify != 2 {
		t.Fatal("未设置应只询问一次")
	}
	if err := service.Cancel(t.Context()); err != nil {
		t.Fatal(err)
	}
	state, _ = service.State(t.Context())
	if state.Pending || store.saves != 0 {
		t.Fatal("取消不能记住或关闭")
	}
	service.RequestClose()
	if err := service.Resolve(t.Context(), domain.CloseBackground, false); err != nil {
		t.Fatal(err)
	}
	if *hide != 1 || *quit != 0 || store.saves != 0 {
		t.Fatal("单次后台不得保存")
	}
	service.RequestClose()
	state, _ = service.State(t.Context())
	if !state.Pending {
		t.Fatal("未记住时下次仍应询问")
	}
}

func TestWindowCloseRememberAndQuitOnce(t *testing.T) {
	for _, mode := range []string{domain.CloseQuit, domain.CloseBackground} {
		t.Run(mode, func(t *testing.T) {
			service, store, hide, quit, _ := closeFixture(t, true)
			service.RequestClose()
			if err := service.Resolve(t.Context(), mode, true); err != nil {
				t.Fatal(err)
			}
			if store.mode != mode || store.saves != 1 {
				t.Fatal("应保存选择")
			}
			if mode == domain.CloseQuit {
				service.RequestClose()
				if *quit != 1 || *hide != 0 {
					t.Fatal("退出不能重入")
				}
			} else {
				service.RequestClose()
				if *hide != 2 || *quit != 0 {
					t.Fatal("记住后应直接后台")
				}
				if err := service.SetMode(t.Context(), domain.CloseAsk); err != nil {
					t.Fatal(err)
				}
				service.RequestClose()
				state, _ := service.State(t.Context())
				if !state.Pending {
					t.Fatal("应能恢复每次询问")
				}
			}
		})
	}
}

func TestWindowCloseFailureAndInvalidInput(t *testing.T) {
	service, store, hide, quit, _ := closeFixture(t, false)
	for _, mode := range []string{"", "../../path", domain.CloseBackground} {
		if err := service.SetMode(t.Context(), mode); err == nil {
			t.Fatal("必须拒绝非法或不支持的行为")
		}
	}
	if err := service.Resolve(t.Context(), domain.CloseQuit, true); err == nil {
		t.Fatal("未请求关闭不能确认")
	}
	service.RequestClose()
	if err := service.Resolve(t.Context(), domain.CloseAsk, false); err == nil {
		t.Fatal("确认不能选择询问")
	}
	store.err = errors.New("private-path-token")
	if err := service.Resolve(t.Context(), domain.CloseQuit, true); err == nil || err.Error() == store.err.Error() {
		t.Fatal("应返回安全保存错误")
	}
	state, _ := service.State(t.Context())
	if !state.Pending || *hide != 0 || *quit != 0 {
		t.Fatal("保存失败必须保留窗口")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := service.Resolve(ctx, domain.CloseQuit, false); !errors.Is(err, context.Canceled) {
		t.Fatal("取消上下文不能执行关闭")
	}
	if err := service.Resolve(t.Context(), domain.CloseQuit, false); err != nil {
		t.Fatal(err)
	}
	if *quit != 1 {
		t.Fatal("用户取消记住后允许单次退出")
	}
}

func TestWindowCloseConcurrentRequestAndBrokenPreference(t *testing.T) {
	var notifications int
	var notifyMu sync.Mutex
	store := &closeStore{mode: "invalid", err: errors.New("broken")}
	service, err := NewWindowLifecycle(t.Context(), store, WindowCloseEffects{
		Notify: func() { notifyMu.Lock(); notifications++; notifyMu.Unlock() },
	}, true)
	if err == nil {
		t.Fatal("偏好损坏必须报告")
	}
	var wg sync.WaitGroup
	for range 20 {
		wg.Go(service.RequestClose)
	}
	wg.Wait()
	state, _ := service.State(t.Context())
	if !state.Pending || state.Mode != domain.CloseAsk || notifications < 1 {
		t.Fatal("并发关闭必须复用同一待确认状态")
	}
}
