package app

import (
	"context"
	"log/slog"
	"runtime"

	"omnimail/desktop/internal/config"
	"omnimail/desktop/internal/service"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

const closeStateEvent = "omnimail:window-close-changed"

func backgroundSupported() bool { return runtime.GOOS == "windows" || runtime.GOOS == "darwin" }

func showMainWindow() {
	if window, ok := application.Get().Window.GetByName("main"); ok {
		window.Show()
		window.Restore()
		window.Focus()
	}
}

func newWindowLifecycle(ctx context.Context, cfg config.Config, log *slog.Logger) *service.WindowLifecycle {
	lifecycle, err := service.NewWindowLifecycle(ctx, config.NewClosePreferences(cfg.DataDir), service.WindowCloseEffects{
		Hide: func() {
			if window, ok := application.Get().Window.GetByName("main"); ok {
				window.Hide()
			}
		},
		Quit: func() { application.Get().Quit() },
		Notify: func() {
			if window, ok := application.Get().Window.GetByName("main"); ok {
				window.EmitEvent(closeStateEvent)
			}
		},
	}, backgroundSupported())
	if err != nil {
		// 记录安全结果而不是底层文件错误，偏好损坏不能导致直接退出或无提示隐藏。
		log.Warn("关闭偏好无法读取，已恢复每次询问")
	}
	return lifecycle
}

func configureWindowClose(app *application.App, window *application.WebviewWindow, lifecycle *service.WindowLifecycle, icon []byte) {
	window.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		event.Cancel()
		lifecycle.RequestClose()
	})
	if !backgroundSupported() {
		return
	}
	tray := app.SystemTray.New().SetIcon(icon)
	tray.SetTooltip("OmniMail")
	tray.OnClick(showMainWindow)
	menu := app.NewMenu()
	menu.Add("打开 OmniMail / Open").OnClick(func(*application.Context) { showMainWindow() })
	menu.AddSeparator()
	// 托盘退出是明确退出命令，不能再次应用“关闭时留在后台”的偏好。
	menu.Add("退出 / Quit").OnClick(func(*application.Context) { app.Quit() })
	tray.SetMenu(menu)
	if runtime.GOOS == "darwin" {
		app.Event.OnApplicationEvent(events.Mac.ApplicationShouldHandleReopen, func(*application.ApplicationEvent) { showMainWindow() })
	}
}
