package updater

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Preferences struct {
	AutoCheck    bool `json:"autoCheck"`
	AutoDownload bool `json:"autoDownload"`
}
type State struct {
	Phase        string      `json:"phase"`
	Current      string      `json:"current"`
	Latest       string      `json:"latest"`
	Notes        string      `json:"notes"`
	Bytes        int64       `json:"bytes"`
	Size         int64       `json:"size"`
	LastCheck    int64       `json:"lastCheck"`
	Error        string      `json:"error"`
	Preferences  Preferences `json:"preferences"`
	Development  bool        `json:"development"`
	Configured   bool        `json:"configured"`
	CanInstall   bool        `json:"canInstall"`
	CurrentNotes string      `json:"currentNotes"`
}
type Paths struct{ Root, Package, Manifest, Signature string }
type Manager struct {
	mu        sync.Mutex
	state     State
	dir       string
	manifest  Manifest
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
	busy      bool
	installed func() bool
	apply     func(Paths) error
	closed    bool
	started   bool
}

func New(dir, version string, installed func() bool, apply func(Paths) error) *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	m := &Manager{dir: dir, ctx: ctx, cancel: cancel, installed: installed, apply: apply,
		state: State{Phase: "idle", Current: version, Development: ReleaseMode != "release" || !ValidVersion(version), Configured: validPublicKey(), Preferences: Preferences{AutoCheck: true}}}
	if exe, err := os.Executable(); err == nil {
		if data, err := os.ReadFile(filepath.Join(filepath.Dir(exe), "RELEASE_NOTES.txt")); err == nil && len(data) <= 32<<10 {
			m.state.CurrentNotes = string(data)
		}
	}
	data, err := os.ReadFile(filepath.Join(dir, "update-preferences.json"))
	if err == nil && len(data) <= 1024 {
		if json.Unmarshal(data, &m.state.Preferences) != nil {
			m.state.Error = "UPDATE_PREFERENCES_FAILED"
		}
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		m.state.Error = "UPDATE_PREFERENCES_FAILED"
	}
	return m
}
func (m *Manager) Snapshot() State {
	m.mu.Lock()
	defer m.mu.Unlock()
	state := m.state
	state.CanInstall = state.Phase == "ready" && !state.Development && state.Configured && m.installed()
	return state
}
func (m *Manager) SetPreferences(ctx context.Context, prefs Preferences) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	data, err := json.Marshal(prefs)
	if err != nil {
		return ErrUpdate
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	root, err := os.OpenRoot(m.dir)
	if err != nil {
		return ErrUpdate
	}
	defer root.Close()
	file, err := root.OpenFile(".update-preferences.tmp", os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return ErrUpdate
	}
	defer root.Remove(".update-preferences.tmp")
	_, writeErr := file.Write(data)
	syncErr, closeErr := file.Sync(), file.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil {
		return ErrUpdate
	}
	if root.Rename(".update-preferences.tmp", "update-preferences.json") != nil {
		return ErrUpdate
	}
	m.state.Preferences = prefs
	return nil
}
func (m *Manager) Start() {
	m.mu.Lock()
	if m.state.Development || m.closed || m.started {
		m.mu.Unlock()
		return
	}
	m.started = true
	m.wg.Add(1)
	m.mu.Unlock()
	go func() {
		defer m.wg.Done()
		timer := time.NewTimer(15 * time.Second)
		defer timer.Stop()
		for {
			select {
			case <-m.ctx.Done():
				return
			case <-timer.C:
				// Check 已把安全错误写入状态；取消时退出调度，不重复生成通知。
				if m.Snapshot().Preferences.AutoCheck {
					if err := m.Check(m.ctx); err != nil && m.ctx.Err() != nil {
						return
					}
				}
				timer.Reset(6 * time.Hour)
			}
		}
	}()
}
func (m *Manager) Check(ctx context.Context) error {
	caller := ctx
	m.mu.Lock()
	if m.busy {
		m.mu.Unlock()
		return nil
	}
	if m.closed {
		m.mu.Unlock()
		return context.Canceled
	}
	if !m.state.Configured {
		m.state.Error = "UPDATE_NOT_CONFIGURED"
		m.mu.Unlock()
		return ErrUpdate
	}
	m.busy = true
	m.wg.Add(1)
	m.state.Phase = "checking"
	m.state.Error = ""
	m.mu.Unlock()
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	stop := context.AfterFunc(m.ctx, cancel)
	defer func() { stop(); cancel(); m.wg.Done() }()
	value, raw, sig, err := fetchLatest(ctx, PublicKey)
	m.mu.Lock()
	if err != nil {
		m.busy = false
		m.state.Phase = "error"
		m.state.Error = "UPDATE_CHECK_FAILED"
		m.mu.Unlock()
		return ErrUpdate
	}
	m.state.LastCheck = time.Now().UnixMilli()
	if !Newer(value.Version, strings.Split(m.state.Current, "-")[0]) {
		m.busy = false
		m.state.Phase = "upToDate"
		m.mu.Unlock()
		return nil
	}
	m.manifest = value
	m.state.Latest = value.Version
	m.state.Notes = value.Notes
	m.state.Size = value.Size
	m.state.Phase = "available"
	auto := m.state.Preferences.AutoDownload && !m.state.Development
	m.mu.Unlock()
	if err := saveManifest(m.dir, raw, sig); err != nil {
		m.fail("UPDATE_STORAGE_FAILED")
		return err
	}
	m.mu.Lock()
	m.busy = false
	m.mu.Unlock()
	if auto {
		return m.Download(caller)
	}
	return nil
}
func (m *Manager) Download(ctx context.Context) error {
	m.mu.Lock()
	if m.closed || m.state.Development || !m.state.Configured || !m.installed() || m.busy || m.state.Latest == "" {
		m.mu.Unlock()
		return ErrUpdate
	}
	m.busy = true
	m.wg.Add(1)
	m.state.Phase = "downloading"
	value := m.manifest
	m.mu.Unlock()
	ctx, cancel := context.WithTimeout(ctx, 15*time.Minute)
	stop := context.AfterFunc(m.ctx, cancel)
	defer func() { stop(); cancel(); m.wg.Done() }()
	err := download(ctx, m.dir, value, func(count int64) { m.mu.Lock(); m.state.Bytes = count; m.mu.Unlock() })
	m.mu.Lock()
	m.busy = false
	if err != nil {
		m.state.Phase = "error"
		m.state.Error = "UPDATE_DOWNLOAD_FAILED"
	} else {
		m.state.Phase = "ready"
		m.state.Error = ""
	}
	m.mu.Unlock()
	if err != nil {
		return ErrUpdate
	}
	return nil
}
func (m *Manager) Install(ctx context.Context) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	state := m.Snapshot()
	if !state.CanInstall {
		return ErrUpdate
	}
	root := filepath.Join(m.dir, "updates")
	paths := Paths{root, filepath.Join(root, PackageName(state.Latest)), filepath.Join(root, "manifest.json"), filepath.Join(root, "manifest.sig")}
	if err := verifyPaths(paths, PublicKey, state.Current); err != nil {
		return err
	}
	if err := m.apply(paths); err != nil {
		m.fail("UPDATE_INSTALL_FAILED")
		return ErrUpdate
	}
	m.mu.Lock()
	m.state.Phase = "installing"
	m.mu.Unlock()
	return nil
}
func (m *Manager) fail(code string) {
	m.mu.Lock()
	m.busy = false
	m.state.Phase = "error"
	m.state.Error = code
	m.mu.Unlock()
}
func (m *Manager) Close() { m.mu.Lock(); m.closed = true; m.cancel(); m.mu.Unlock(); m.wg.Wait() }
