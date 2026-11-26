package main

import (
	"sync"
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/events"
	"omnimail/internal/updater"
)

type BootstrapStateDTO struct {
	Bootstrap    BootstrapConfig    `json:"bootstrap"`
	Preferences  DesktopPreferences `json:"preferences"`
	Storage      StorageInfo        `json:"storage"`
	LaunchIntent LaunchIntent       `json:"launchIntent"`
}

type InitialSetupInput struct {
	DataDir     string             `json:"dataDir"`
	Preferences DesktopPreferences `json:"preferences"`
}

type DesktopService struct {
	mu            sync.Mutex
	store         *DesktopStateStore
	app           *application.App
	win           *application.WebviewWindow
	tray          *application.SystemTray
	bus           *events.Bus
	updaterMgr    *updater.Manager
	beforeQuit    func()
	pendingIntent LaunchIntent
	quitting      atomic.Bool
}

func NewDesktopService(store *DesktopStateStore, initialIntent LaunchIntent) *DesktopService {
	if store == nil {
		store = newDefaultStateStore()
	}
	svc := &DesktopService{
		store:         store,
		pendingIntent: initialIntent,
	}
	svc.updaterMgr = updater.NewManager(func(p updater.ProgressPayload) {
		svc.emitUpdaterProgress(p)
	})
	return svc
}

func (s *DesktopService) attachUpdaterHooks(bus *events.Bus, beforeQuit func()) {
	s.mu.Lock()
	s.bus = bus
	s.beforeQuit = beforeQuit
	s.mu.Unlock()
}

func (s *DesktopService) emitUpdaterProgress(p updater.ProgressPayload) {
	s.mu.Lock()
	bus := s.bus
	app := s.app
	s.mu.Unlock()
	if bus != nil {
		bus.Emit(events.UpdaterProgress, p)
		return
	}
	if app != nil {
		app.Event.Emit(events.UpdaterProgress, p)
	}
}

func (s *DesktopService) ensureStore() *DesktopStateStore {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.store == nil {
		s.store = newDefaultStateStore()
	}
	return s.store
}

func (s *DesktopService) ensureUpdater() *updater.Manager {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.updaterMgr == nil {
		s.updaterMgr = updater.NewManager(func(p updater.ProgressPayload) {
			s.emitUpdaterProgress(p)
		})
	}
	return s.updaterMgr
}

func (s *DesktopService) bindRuntime(app *application.App, win *application.WebviewWindow) {
	s.mu.Lock()
	s.app = app
	s.win = win
	s.mu.Unlock()
}

func (s *DesktopService) bindTray(tray *application.SystemTray) {
	s.mu.Lock()
	s.tray = tray
	s.mu.Unlock()
}

func (s *DesktopService) runtimeHandles() (*application.App, *application.WebviewWindow) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.app, s.win
}

func (s *DesktopService) mainWindow() *application.WebviewWindow {
	_, win := s.runtimeHandles()
	return win
}

func (s *DesktopService) requestQuit() {
	s.quitting.Store(true)
	s.mu.Lock()
	fn := s.beforeQuit
	s.mu.Unlock()
	if fn != nil {
		fn()
	}
}

func (s *DesktopService) isQuitting() bool {
	return s.quitting.Load()
}
