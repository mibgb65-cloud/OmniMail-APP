package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"path/filepath"
	"time"

	"omnimail/desktop/internal/bridge"
	"omnimail/desktop/internal/config"
	"omnimail/desktop/internal/platform"
	"omnimail/desktop/internal/service"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

func Run(assets fs.FS, icon []byte) (err error) {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	resources, err := openResources(ctx, cfg)
	cancel()
	if err != nil {
		return err
	}
	defer func() {
		err = errors.Join(err, resources.Close())
	}()

	lifecycle := newWindowLifecycle(context.Background(), cfg, resources.log)
	desktop := newApplication(assets, icon, cfg, resources.log, resources.shutdown, resources.mail, lifecycle, resources.translation, resources.ai)
	window := desktop.Window.NewWithOptions(mainWindowOptions())
	configureWindowClose(desktop, window, lifecycle, icon)
	if info, readErr := platform.Installation(); readErr == nil && info.CanAutoStart && info.AutoStart && platform.StartupLaunch() {
		window.Hide()
	}
	// 通过单实例启动后才开启同步，避免第二次启动短暂重复连接同一邮箱。
	// 自动更新的通知/草稿保护尚未闭环，安装发布阶段不启动后台更新调度。
	desktop.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) { resources.mail.Start() })
	resources.log.Info("应用启动", "version", bridge.Version, "commit", bridge.Commit)
	if err := desktop.Run(); err != nil {
		return fmt.Errorf("桌面应用运行失败: %w", err)
	}
	return nil
}

func mainWindowOptions() application.WebviewWindowOptions {
	return application.WebviewWindowOptions{
		Name: "main", Title: "OmniMail",
		// 默认展开的四栏需要阅读空间；逻辑像素由 Wails 按窗口 DPI 换算，不能缩到正文逐字换行。
		Width: 1750, Height: 950, MinWidth: 1280, MinHeight: 600,
		// 标题栏由前端绘制；保留系统边缘缩放、阴影和圆角，不关闭窗口装饰能力。
		Frameless:        true,
		BackgroundColour: application.NewRGB(246, 246, 247),
		URL:              "/",
	}
}

func newApplication(assets fs.FS, icon []byte, cfg config.Config, log *slog.Logger, shutdown func(), mail *service.Mail, lifecycle *service.WindowLifecycle, translation *service.Translation, ai *service.AI) *application.App {
	// 开发与正式数据目录隔离时，也应使用不同的单实例标识。
	dataHash := sha256.Sum256([]byte(cfg.DataDir))
	return application.New(application.Options{
		Name: "OmniMail", Description: "本地优先的桌面邮件客户端",
		Icon:   icon,
		Logger: log, LogLevel: cfg.LogLevel, OnShutdown: shutdown,
		Services: []application.Service{application.NewService(bridge.NewAppBridge(func(text string) bool {
			return application.Get().Clipboard.SetText(text)
		})),
			application.NewService(bridge.NewMailBridge(mail, saveAttachment)),
			application.NewService(bridge.NewStorageBridge(service.NewStorage(cfg.DataDir))),
			application.NewService(bridge.NewWindowLifecycleBridge(lifecycle)),
			application.NewService(bridge.NewCustomProvidersBridge(service.NewCustomProviders(config.NewCustomProviders(cfg.DataDir)))),
			application.NewService(bridge.NewTranslationBridge(translation)),
			application.NewService(bridge.NewAIBridge(ai, translation)),
			application.NewService(bridge.NewInstallationBridge())},
		Assets: application.AssetOptions{Handler: application.AssetFileServerFS(assets)},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
		Windows: application.WindowsOptions{WebviewUserDataPath: filepath.Join(cfg.DataDir, "webview")},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "app.omnimail.desktop." + hex.EncodeToString(dataHash[:12]),
			OnSecondInstanceLaunch: func(_ application.SecondInstanceData) {
				// 不消费或记录第二实例传入的命令行，避免将外部输入带入业务层。
				showMainWindow()
			},
		},
	})
}
