package main

import (
	"sync"
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"
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
	pendingIntent LaunchIntent
	quitting      atomic.Bool
}

func NewDesktopService(store *DesktopStateStore, initialIntent LaunchIntent) *DesktopService {
	if store == nil {
		store = newDefaultStateStore()
	}
	return &DesktopService{
		store:         store,
		pendingIntent: initialIntent,
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
}

func (s *DesktopService) isQuitting() bool {
	return s.quitting.Load()
}
