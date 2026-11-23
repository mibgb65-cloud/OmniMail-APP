package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

const (
	minWindowWidth      = 960
	minWindowHeight     = 640
	defaultWindowWidth  = 1440
	defaultWindowHeight = 900
)

type WindowGeometryState struct {
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	HasPos    bool `json:"hasPos"`
	Maximised bool `json:"maximised"`
}

func normalizeWindowGeometry(in WindowGeometryState) WindowGeometryState {
	out := in
	if out.Width < minWindowWidth {
		out.Width = defaultWindowWidth
	}
	if out.Height < minWindowHeight {
		out.Height = defaultWindowHeight
	}
	if out.Width > 7680 {
		out.Width = defaultWindowWidth
	}
	if out.Height > 4320 {
		out.Height = defaultWindowHeight
	}
	// 屏蔽 Windows 最小化时的 -32000 伪坐标与异常离屏位置
	if out.HasPos && (out.X < -4000 || out.Y < -4000 || out.X > 16000 || out.Y > 16000) {
		out.HasPos = false
		out.X = 0
		out.Y = 0
	}
	return out
}

func (s *DesktopStateStore) windowStateFilePath() string {
	return filepath.Join(s.getDataDir(), "window-state.json")
}

func (s *DesktopStateStore) readWindowGeometry() WindowGeometryState {
	def := WindowGeometryState{Width: defaultWindowWidth, Height: defaultWindowHeight}
	raw, err := os.ReadFile(s.windowStateFilePath())
	if err != nil {
		return def
	}
	var loaded WindowGeometryState
	if err := json.Unmarshal(raw, &loaded); err != nil {
		return def
	}
	return normalizeWindowGeometry(loaded)
}

func (s *DesktopStateStore) saveWindowGeometry(state WindowGeometryState) {
	norm := normalizeWindowGeometry(state)
	dataDir := s.getDataDir()
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return
	}
	raw, err := json.MarshalIndent(norm, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(filepath.Join(dataDir, "window-state.json"), raw, 0o600)
}

func attachWindowLifecycle(app *application.App, win *application.WebviewWindow, svc *DesktopService) {
	var mu sync.Mutex
	cur := svc.store.readWindowGeometry()

	snapshotNormal := func() {
		if win.IsMaximised() || win.IsMinimised() {
			return
		}
		b := win.Bounds()
		if b.Width < minWindowWidth || b.Height < minWindowHeight {
			return
		}
		mu.Lock()
		cur.X = b.X
		cur.Y = b.Y
		cur.Width = b.Width
		cur.Height = b.Height
		cur.HasPos = true
		cur.Maximised = false
		saved := cur
		mu.Unlock()
		svc.store.saveWindowGeometry(saved)
	}

	setMaxState := func(maximised bool) {
		mu.Lock()
		cur.Maximised = maximised
		saved := cur
		mu.Unlock()
		svc.store.saveWindowGeometry(saved)
	}

	win.OnWindowEvent(events.Common.WindowDidMove, func(_ *application.WindowEvent) {
		snapshotNormal()
	})
	win.OnWindowEvent(events.Common.WindowDidResize, func(_ *application.WindowEvent) {
		snapshotNormal()
	})
	win.OnWindowEvent(events.Common.WindowMaximise, func(_ *application.WindowEvent) {
		setMaxState(true)
	})
	win.OnWindowEvent(events.Common.WindowUnMaximise, func(_ *application.WindowEvent) {
		setMaxState(false)
		snapshotNormal()
	})
	win.OnWindowEvent(events.Common.WindowRestore, func(_ *application.WindowEvent) {
		setMaxState(win.IsMaximised())
		snapshotNormal()
	})

	win.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		snapshotNormal()
		setMaxState(win.IsMaximised())
		if !svc.isQuitting() && svc.store.readPreferences().CloseToTray {
			event.Cancel()
			win.Hide()
			return
		}
		svc.requestQuit()
		app.Quit()
	})
}
