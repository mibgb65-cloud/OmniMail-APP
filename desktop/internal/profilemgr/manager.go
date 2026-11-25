package profilemgr

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"sync"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/mailrepair"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

type Manager struct {
	mu       sync.Mutex
	boot     BootstrapAdapter
	bus      *events.Bus
	pinGuard *security.PINGuard
	unlocked map[string]bool
	active   *Session
	hooks    []SessionHook
}

func NewManager(boot BootstrapAdapter, bus *events.Bus) *Manager {
	return &Manager{
		boot:     boot,
		bus:      bus,
		pinGuard: security.NewPINGuard(),
		unlocked: make(map[string]bool),
	}
}

func (m *Manager) RegisterHook(h SessionHook) {
	m.mu.Lock()
	m.hooks = append(m.hooks, h)
	if sess := m.active; sess != nil {
		m.mu.Unlock()
		h.OnSessionOpened(sess)
		return
	}
	m.mu.Unlock()
}

func findActiveMeta(reg config.ProfileRegistry, activeID string) config.ProfileMeta {
	for _, p := range reg.Profiles {
		if p.ID == activeID {
			return p
		}
	}
	return reg.Profiles[0]
}

// InitStartup 在应用启动或完成初始化时加载空间注册表，若未设 PIN 则直接打开活跃空间。
func (m *Manager) InitStartup() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	bs := m.boot.ReadBootstrapState()
	reg, err := config.LoadRegistry(bs.DataDir)
	if err != nil {
		return err
	}
	target := findActiveMeta(reg, bs.ActiveProfileID)
	if bs.ActiveProfileID != target.ID || bs.LaunchBehavior == "" {
		bs.ActiveProfileID = target.ID
		if bs.LaunchBehavior == "" {
			bs.LaunchBehavior = "last-profile"
		}
		if bs.Initialized {
			_ = m.boot.WriteBootstrapState(bs)
		}
	}
	if target.PinEnabled && !m.unlocked[target.ID] {
		return nil
	}
	return m.openSessionUnlocked(bs.DataDir, target)
}

func (m *Manager) openSessionUnlocked(rootDir string, meta config.ProfileMeta) error {
	m.closeActiveUnlocked()
	profDir := config.ResolveProfileDir(rootDir, meta)
	if err := config.EnsureProfileDirectories(profDir); err != nil {
		return err
	}
	db, err := storage.OpenProfileDB(profDir)
	if err != nil {
		return err
	}
	vault, err := security.OpenVault(meta.ID, profDir)
	if err != nil {
		_ = storage.CheckpointAndClose(db)
		return err
	}
	blobs := storage.NewBlobStore(profDir)
	_ = mailrepair.MigrateLegacyMailData(db, blobs)
	migrateAiEndpointKey(vault, config.LoadProfileSettings(profDir))
	ctx, cancel := context.WithCancel(context.Background())
	sess := &Session{
		Meta: meta, ProfileDir: profDir, DB: db, Vault: vault,
		Blobs: blobs, Ctx: ctx, Cancel: cancel,
	}
	m.active = sess
	hooks := append([]SessionHook(nil), m.hooks...)
	go func() {
		for _, h := range hooks {
			h.OnSessionOpened(sess)
		}
	}()
	return nil
}

func (m *Manager) closeActiveUnlocked() {
	if m.active == nil {
		return
	}
	sess := m.active
	m.active = nil
	sess.Cancel()
	for _, h := range m.hooks {
		h.OnSessionClosing(sess)
	}
	_ = storage.CheckpointAndClose(sess.DB)
}

func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closeActiveUnlocked()
}

func (m *Manager) PauseForMigration()          { m.Close() }
func (m *Manager) ResumeAfterMigration() error { return m.InitStartup() }

func (m *Manager) ActiveSession() (*Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.active != nil {
		return m.active, nil
	}
	bs := m.boot.ReadBootstrapState()
	reg, err := config.LoadRegistry(bs.DataDir)
	if err != nil {
		return nil, err
	}
	target := findActiveMeta(reg, bs.ActiveProfileID)
	if target.PinEnabled && !m.unlocked[target.ID] {
		return nil, apperr.New(apperr.CodePinRequired, "当前工作空间已上锁，请输入 PIN 解锁")
	}
	if err := m.openSessionUnlocked(bs.DataDir, target); err != nil {
		return nil, err
	}
	return m.active, nil
}

func countAccountsQuick(rootDir string, meta config.ProfileMeta, active *Session) int {
	if active != nil && active.Meta.ID == meta.ID && active.DB != nil {
		var n int
		_ = active.DB.QueryRow(`SELECT COUNT(1) FROM accounts`).Scan(&n)
		return n
	}
	profDir := config.ResolveProfileDir(rootDir, meta)
	dbFile := filepath.Join(profDir, "mail.db")
	if _, err := os.Stat(dbFile); err != nil {
		return 0
	}
	db, err := sql.Open("sqlite", dbFile+"?mode=ro&_pragma=busy_timeout(1500)")
	if err != nil {
		return 0
	}
	defer db.Close()
	var n int
	_ = db.QueryRow(`SELECT COUNT(1) FROM accounts`).Scan(&n)
	return n
}

func (m *Manager) buildSummaryUnlocked(rootDir string, meta config.ProfileMeta) ProfileSummary {
	locked := meta.PinEnabled && !m.unlocked[meta.ID]
	return ProfileSummary{
		ID:              meta.ID,
		Name:            meta.Name,
		Badge:           meta.Badge,
		Color:           meta.Color,
		CustomDir:       meta.CustomDir,
		ProfileDir:      config.ResolveProfileDir(rootDir, meta),
		ThemePreference: meta.ThemePreference,
		PinEnabled:      meta.PinEnabled,
		Locked:          locked,
		AccountCount:    countAccountsQuick(rootDir, meta, m.active),
		CreatedAt:       meta.CreatedAt,
		LastActiveAt:    meta.LastActiveAt,
	}
}

func nowISO() string { return time.Now().UTC().Format(time.RFC3339) }
