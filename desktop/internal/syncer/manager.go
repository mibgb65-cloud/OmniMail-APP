package syncer

import (
	"context"
	"sync"
	"time"

	"omnimail/internal/accounts"
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
	"omnimail/internal/search"
)

type Manager struct {
	mu            sync.Mutex
	sess          *profilemgr.Session
	tm            *oauth.TokenManager
	bus           *events.Bus
	hooks         PipelineHooks
	workers       map[string]*SyncWorker
	backfillLocks map[string]*sync.Mutex
	pollCancel    context.CancelFunc
	pollMinutes   int
	onUnreadSync  func(unread int)
}

func NewManager(tm *oauth.TokenManager, bus *events.Bus) *Manager {
	if tm == nil {
		tm = oauth.NewTokenManager()
	}
	return &Manager{
		tm:            tm,
		bus:           bus,
		workers:       make(map[string]*SyncWorker),
		backfillLocks: make(map[string]*sync.Mutex),
		pollMinutes:   5,
	}
}

func (m *Manager) SetPipelineHooks(h PipelineHooks) {
	m.mu.Lock()
	m.hooks = h
	m.mu.Unlock()
}

func (m *Manager) SetUnreadCallback(fn func(int)) {
	m.mu.Lock()
	m.onUnreadSync = fn
	m.mu.Unlock()
}

func (m *Manager) OnSessionOpened(sess *profilemgr.Session) {
	m.mu.Lock()
	m.stopAllUnlocked()
	m.sess = sess
	cfg := config.LoadProfileSettings(sess.ProfileDir)
	if cfg.SyncIntervalMinutes > 0 {
		m.pollMinutes = cfg.SyncIntervalMinutes
	}
	m.restartTimersUnlocked()
	m.mu.Unlock()

	list, err := accounts.List(sess.DB, sess.Vault)
	if err == nil {
		for _, acc := range list {
			m.StartAccount(acc.ID)
		}
	}
	m.notifyTrayUnread()
}

func (m *Manager) OnSessionClosing(sess *profilemgr.Session) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sess != nil && m.sess.Meta.ID == sess.Meta.ID {
		m.stopAllUnlocked()
		m.sess = nil
	}
}

func (m *Manager) OnSettingsChanged(_ *profilemgr.Session, next config.AppSettings) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if next.SyncIntervalMinutes > 0 && next.SyncIntervalMinutes != m.pollMinutes {
		m.pollMinutes = next.SyncIntervalMinutes
		m.restartTimersUnlocked()
	}
}

func (m *Manager) StartAccount(accountID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sess == nil || accountID == "" {
		return
	}
	if _, exists := m.workers[accountID]; exists {
		return
	}
	m.workers[accountID] = newSyncWorker(m.sess.Ctx, m.sess, accountID, m.tm, m.bus, m.hooks)
}

func (m *Manager) StopAccount(accountID string) {
	m.mu.Lock()
	w, ok := m.workers[accountID]
	if ok {
		delete(m.workers, accountID)
	}
	m.mu.Unlock()
	if ok && w != nil {
		w.Stop()
	}
}

func (m *Manager) TriggerSync(accountID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sess == nil {
		return nil
	}
	if accountID != "" {
		if w, ok := m.workers[accountID]; ok {
			w.Trigger()
		} else {
			m.workers[accountID] = newSyncWorker(m.sess.Ctx, m.sess, accountID, m.tm, m.bus, m.hooks)
		}
		return nil
	}
	for _, w := range m.workers {
		w.Trigger()
	}
	return nil
}

func (m *Manager) stopAllUnlocked() {
	if m.pollCancel != nil {
		m.pollCancel()
		m.pollCancel = nil
	}
	for id, w := range m.workers {
		delete(m.workers, id)
		go w.Stop()
	}
}

func (m *Manager) restartTimersUnlocked() {
	if m.pollCancel != nil {
		m.pollCancel()
	}
	if m.sess == nil {
		return
	}
	ctx, cancel := context.WithCancel(m.sess.Ctx)
	m.pollCancel = cancel
	pollDur := time.Duration(m.pollMinutes) * time.Minute
	db := m.sess.DB

	go func() {
		pollTick := time.NewTicker(pollDur)
		snoozeTick := time.NewTicker(30 * time.Second)
		defer pollTick.Stop()
		defer snoozeTick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-pollTick.C:
				_ = m.TriggerSync("")
				m.notifyTrayUnread()
			case <-snoozeTick.C:
				if woke := wakeDueSnoozed(db); len(woke) > 0 && m.bus != nil {
					counts, _ := search.GetFolderCounts(db, "")
					m.bus.Emit(events.MailDelta, events.MailDeltaPayload{UpdatedIDs: woke, FolderCounts: counts.Counts})
					m.notifyTrayUnread()
				}
			}
		}
	}()
}

func (m *Manager) notifyTrayUnread() {
	m.mu.Lock()
	sess := m.sess
	cb := m.onUnreadSync
	m.mu.Unlock()
	if sess == nil || cb == nil {
		return
	}
	counts, err := search.GetFolderCounts(sess.DB, "")
	if err == nil {
		cb(counts.Counts["inbox"])
	}
}
