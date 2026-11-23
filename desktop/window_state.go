package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

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

func mainWindowOptions(geom WindowGeometryState, theme string, autostart, hidden bool) application.WebviewWindowOptions {
	startURL := "/"
	if hidden {
		startURL = "/?silent=1"
	} else if autostart {
		startURL = "/?autostart=1"
	}
	opts := application.WebviewWindowOptions{
		Name:             "main",
		Title:            "OmniMail",
		Width:            geom.Width,
		Height:           geom.Height,
		MinWidth:         minWindowWidth,
		MinHeight:        minWindowHeight,
		Frameless:        true,
		Hidden:           hidden,
		BackgroundColour: splashWindowBackground(theme),
		URL:              startURL,
		DevToolsEnabled:  !isProductionBuild,
		InitialPosition:  application.WindowCentered,
		StartState:       application.WindowStateNormal,
	}
	if geom.HasPos {
		opts.InitialPosition = application.WindowXY
		opts.X, opts.Y = geom.X, geom.Y
	}
	return opts
}

func attachWindowLifecycle(app *application.App, win *application.WebviewWindow, svc *DesktopService, cur WindowGeometryState, hidden bool) {
	var mu sync.Mutex
	var restoreMaximised atomic.Bool
	restoreMaximised.Store(cur.Maximised && !hidden)

	var restoreOnce sync.Once
	win.OnWindowEvent(events.Common.WindowRuntimeReady, func(_ *application.WindowEvent) {
		restoreOnce.Do(func() {
			if restoreMaximised.Load() {
				// Wails Windows 会先应用 StartState，再按普通窗口坐标重新移动窗口。
				// 等初始几何和 WebView 就绪再最大化，避免窗口处于最大化状态却偏离工作区。
				win.Maximise()
				restoreMaximised.Store(false)
			}
		})
	})

	snapshotNormal := func() {
		if restoreMaximised.Load() || win.IsMaximised() || win.IsMinimised() {
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
		svc.store.saveWindowGeometry(cur)
		mu.Unlock()
	}

	setMaxState := func(maximised bool) {
		mu.Lock()
		cur.Maximised = maximised
		svc.store.saveWindowGeometry(cur)
		mu.Unlock()
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
		if !win.IsMinimised() && !restoreMaximised.Load() {
			setMaxState(win.IsMaximised())
		}
		if !svc.isQuitting() && svc.store.readPreferences().CloseToTray {
			event.Cancel()
			win.Hide()
			return
		}
		svc.requestQuit()
		app.Quit()
	})
}
