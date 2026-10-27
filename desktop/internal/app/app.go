package app

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"sync"

	"omnimail/desktop/internal/bridge"
	"omnimail/desktop/internal/config"
	"omnimail/desktop/internal/logger"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func Run(assets fs.FS, icon []byte) (err error) {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log, closer, err := logger.New(cfg.DataDir, cfg.LogLevel)
	if err != nil {
		return err
	}
	var closeOnce sync.Once
	var closeErr error
	shutdown := func() {
		closeOnce.Do(func() {
			log.Info("应用关闭")
			closeErr = closer.Close()
		})
	}
	defer func() {
		shutdown()
		err = errors.Join(err, closeErr)
	}()

	desktop := newApplication(assets, icon, cfg, log, shutdown)
	desktop.Window.NewWithOptions(mainWindowOptions())
	log.Info("应用启动", "version", bridge.Version, "commit", bridge.Commit)
	if err := desktop.Run(); err != nil {
		return fmt.Errorf("桌面应用运行失败: %w", err)
	}
	return nil
}

func mainWindowOptions() application.WebviewWindowOptions {
	return application.WebviewWindowOptions{
		Name: "main", Title: "OmniMail",
		Width: 1750, Height: 950, MinWidth: 860, MinHeight: 600,
		// 标题栏由前端绘制；保留系统边缘缩放、阴影和圆角，不关闭窗口装饰能力。
		Frameless:        true,
		BackgroundColour: application.NewRGB(246, 246, 247),
		URL:              "/",
	}
}

func newApplication(assets fs.FS, icon []byte, cfg config.Config, log *slog.Logger, shutdown func()) *application.App {
	// 开发与正式数据目录隔离时，也应使用不同的单实例标识。
	dataHash := sha256.Sum256([]byte(cfg.DataDir))
	return application.New(application.Options{
		Name: "OmniMail", Description: "本地优先的桌面邮件客户端",
		Icon:   icon,
		Logger: log, LogLevel: cfg.LogLevel, OnShutdown: shutdown,
		Services: []application.Service{application.NewService(bridge.NewAppBridge())},
		Assets:   application.AssetOptions{Handler: application.AssetFileServerFS(assets)},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "app.omnimail.desktop." + hex.EncodeToString(dataHash[:12]),
			OnSecondInstanceLaunch: func(_ application.SecondInstanceData) {
				// 不消费或记录第二实例传入的命令行，避免将外部输入带入业务层。
				if window, ok := application.Get().Window.GetByName("main"); ok {
					window.Restore()
					window.Focus()
				}
			},
		},
	})
}
