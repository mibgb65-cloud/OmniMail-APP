package bridge

import (
	"omnimail/desktop/internal/config"
	"omnimail/desktop/internal/service"
	"testing"
)

func TestWindowLifecycleBridgeRealPreferences(t *testing.T) {
	quit, hide := 0, 0
	lifecycle, err := service.NewWindowLifecycle(t.Context(), config.NewClosePreferences(t.TempDir()), service.WindowCloseEffects{
		Notify: func() {}, Quit: func() { quit++ }, Hide: func() { hide++ },
	}, true)
	if err != nil {
		t.Fatal(err)
	}
	bridge := NewWindowLifecycleBridge(lifecycle)
	if err := bridge.SetMode(t.Context(), "invalid"); err == nil {
		t.Fatal("必须拒绝非法偏好")
	}
	if err := bridge.SetMode(t.Context(), "background"); err != nil {
		t.Fatal(err)
	}
	state, err := bridge.State(t.Context())
	if err != nil || state.Mode != "background" || quit != 0 || hide != 0 {
		t.Fatal("保存设置不应直接关闭窗口")
	}
	if err := bridge.SetMode(t.Context(), "ask"); err != nil {
		t.Fatal(err)
	}
	lifecycle.RequestClose()
	if err := bridge.Cancel(t.Context()); err != nil {
		t.Fatal(err)
	}
	state, _ = bridge.State(t.Context())
	if state.Pending {
		t.Fatal("取消后应保持窗口")
	}
	lifecycle.RequestClose()
	if err := bridge.Resolve(t.Context(), "quit", true); err != nil {
		t.Fatal(err)
	}
	if quit != 1 || hide != 0 {
		t.Fatal("确认应只执行一次")
	}
}
