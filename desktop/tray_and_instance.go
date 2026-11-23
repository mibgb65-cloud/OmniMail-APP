package main

import (
	_ "embed"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/events"
	"omnimail/internal/profilemgr"
)

//go:embed build/appicon.png
var embeddedAppIconPNG []byte

//go:embed build/windows/icon.ico
var embeddedWindowsICO []byte

type LaunchIntent struct {
	MailtoURL string `json:"mailtoUrl,omitempty"`
	FilePath  string `json:"filePath,omitempty"`
}

func extractLaunchIntent(args []string) LaunchIntent {
	var intent LaunchIntent
	for _, raw := range args {
		arg := strings.Trim(strings.TrimSpace(raw), `"`)
		if arg == "" || strings.HasPrefix(arg, "-") {
			continue
		}
		lower := strings.ToLower(arg)
		if strings.HasPrefix(lower, "mailto:") && len(arg) <= 1024 {
			intent.MailtoURL = arg
			continue
		}
		ext := strings.ToLower(filepath.Ext(arg))
		if (ext == ".eml" || ext == ".ics") && len(arg) <= 512 && filepath.IsAbs(arg) {
			intent.FilePath = filepath.Clean(arg)
		}
	}
	return intent
}

func wakeMainWindow(win *application.WebviewWindow) {
	if win == nil {
		return
	}
	if win.IsMinimised() {
		win.UnMinimise()
	}
	win.Show()
	win.Focus()
}

func emitLaunchIntent(app *application.App, intent LaunchIntent) {
	if app == nil {
		return
	}
	if intent.MailtoURL != "" {
		app.Event.Emit("app:open-mailto", intent.MailtoURL)
		app.Event.Emit(events.DesktopIntent, events.DesktopIntentPayload{
			Type:    "compose-mailto",
			Payload: intent.MailtoURL,
		})
	}
	if intent.FilePath != "" {
		app.Event.Emit("app:open-file", filepath.Base(intent.FilePath))
		app.Event.Emit(events.DesktopIntent, events.DesktopIntentPayload{
			Type:    "open-eml",
			Payload: intent.FilePath,
		})
	}
}

func setupSystemTray(app *application.App, svc *DesktopService, profMgr *profilemgr.Manager) *application.SystemTray {
	tray := app.SystemTray.New()
	if len(embeddedWindowsICO) > 0 {
		tray.SetIcon(embeddedWindowsICO)
	} else if len(embeddedAppIconPNG) > 0 {
		tray.SetIcon(embeddedAppIconPNG)
	}
	tray.SetTooltip("OmniMail · 本地优先多源邮件工作台")

	wake := func() {
		wakeMainWindow(svc.mainWindow())
	}
	tray.OnClick(wake)
	tray.OnDoubleClick(wake)

	rebuildTrayMenu(app, tray, svc, profMgr)
	svc.bindTray(tray)
	return tray
}

func rebuildTrayMenu(app *application.App, tray *application.SystemTray, svc *DesktopService, profMgr *profilemgr.Manager) {
	if app == nil || tray == nil {
		return
	}
	wake := func() { wakeMainWindow(svc.mainWindow()) }
	menu := app.NewMenu()
	menu.Add("打开 OmniMail").OnClick(func(_ *application.Context) { wake() })
	menu.Add("写新邮件").OnClick(func(_ *application.Context) {
		wake()
		app.Event.Emit("tray:new-compose")
	})
	menu.Add("立即同步全部邮箱").OnClick(func(_ *application.Context) {
		app.Event.Emit("tray:sync-all")
		app.Event.Emit(events.DesktopIntent, events.DesktopIntentPayload{Type: "sync-all"})
	})

	if profMgr != nil {
		if resp, err := profMgr.ListProfiles(); err == nil && len(resp.Profiles) > 0 {
			sub := menu.AddSubmenu("切换本地空间")
			for _, p := range resp.Profiles {
				prof := p
				label := prof.Name
				if prof.ID == resp.ActiveProfileID {
					label = "✓ " + label
				}
				if prof.PinEnabled {
					label += " (PIN)"
				}
				sub.Add(label).OnClick(func(_ *application.Context) {
					wake()
					if prof.PinEnabled && prof.Locked {
						app.Event.Emit(events.DesktopIntent, events.DesktopIntentPayload{
							Type:    "switch-profile",
							Payload: prof.ID,
						})
						return
					}
					_, _ = profMgr.SwitchProfile(prof.ID, "")
				})
			}
		}
	}

	menu.AddSeparator()
	menu.Add("退出").OnClick(func(_ *application.Context) {
		svc.requestQuit()
		app.Quit()
	})
	tray.SetMenu(menu)
}

func updateTrayUnreadCount(tray *application.SystemTray, unread int) {
	if tray == nil {
		return
	}
	if unread > 0 {
		tray.SetTooltip(fmt.Sprintf("OmniMail · %d 封未读邮件", unread))
	} else {
		tray.SetTooltip("OmniMail · 所有邮件已读")
	}
}

func syncSystemAutostart(app *application.App, enabled bool) {
	syncSystemAutostartWithMode(app, enabled, false)
}

func syncSystemAutostartWithMode(app *application.App, enabled bool, silentToTray bool) {
	if app == nil || app.Autostart == nil {
		return
	}
	if enabled {
		args := []string{"--autostart"}
		if silentToTray {
			args = append(args, "--silent-tray")
		}
		_ = app.Autostart.EnableWithOptions(application.AutostartOptions{
			Identifier: "OmniMail",
			Arguments:  args,
		})
		return
	}
	_ = app.Autostart.Disable()
}
