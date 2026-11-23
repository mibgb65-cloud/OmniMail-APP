package profilemgr

import (
	"sync"
	"testing"

	"omnimail/internal/apperr"
	"omnimail/internal/events"
)

type memBootstrap struct {
	mu    sync.Mutex
	state BootstrapState
}

func (m *memBootstrap) ReadBootstrapState() BootstrapState {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state
}

func (m *memBootstrap) WriteBootstrapState(next BootstrapState) error {
	m.mu.Lock()
	m.state = next
	m.mu.Unlock()
	return nil
}

func TestProfileLifecycleSwitchAndPINLock(t *testing.T) {
	boot := &memBootstrap{
		state: BootstrapState{
			DataDir:         t.TempDir(),
			Initialized:     true,
			ActiveProfileID: "personal",
			LaunchBehavior:  "last-profile",
		},
	}
	bus := events.NewBus()
	var switchedID string
	bus.Subscribe(func(name string, payload any) {
		if name == events.ProfileSwitched {
			if p, ok := payload.(events.ProfileSwitchedPayload); ok {
				switchedID = p.ProfileID
			}
		}
	})

	mgr := NewManager(boot, bus)
	defer mgr.Close()
	if err := mgr.InitStartup(); err != nil {
		t.Fatalf("InitStartup 失败: %v", err)
	}

	created, err := mgr.CreateProfile(CreateProfileRequest{
		Name:            "开源社区空间",
		Badge:           "开",
		Color:           "#2563EB",
		ThemePreference: "dark",
		PIN:             "889900",
	})
	if err != nil {
		t.Fatalf("CreateProfile 失败: %v", err)
	}
	if !created.PinEnabled {
		t.Fatal("新建带 PIN 的空间应标记 PinEnabled=true")
	}

	// 手动上锁后，未携带 PIN 切换必须返回 ERR_PIN_REQUIRED
	if err := mgr.LockProfile(created.ID); err != nil {
		t.Fatalf("LockProfile 失败: %v", err)
	}
	if _, err := mgr.SwitchProfile(created.ID, ""); apperr.CodeOf(err) != apperr.CodePinRequired {
		t.Fatalf("未提供 PIN 应返回 ERR_PIN_REQUIRED: %v", err)
	}
	if _, err := mgr.SwitchProfile(created.ID, "111111"); apperr.CodeOf(err) != apperr.CodePinInvalid {
		t.Fatalf("错误 PIN 应返回 ERR_PIN_INVALID: %v", err)
	}

	res, err := mgr.SwitchProfile(created.ID, "889900")
	if err != nil {
		t.Fatalf("正确 PIN 解锁切换失败: %v", err)
	}
	if res.Profile.ID != created.ID || switchedID != created.ID {
		t.Fatalf("切换空间事件未正常发射: res=%s event=%s", res.Profile.ID, switchedID)
	}

	// 切换回默认空间并彻底删除新建空间
	if _, err := mgr.SwitchProfile("personal", ""); err != nil {
		t.Fatalf("切回 personal 失败: %v", err)
	}
	if err := mgr.DeleteProfile(created.ID, true, "889900"); err != nil {
		t.Fatalf("DeleteProfile 失败: %v", err)
	}
}
