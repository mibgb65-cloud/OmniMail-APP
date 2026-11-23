package main

import (
	"log"
	"os"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/ai"
	"omnimail/internal/contacts"
	"omnimail/internal/events"
	"omnimail/internal/oauth"
	"omnimail/internal/outbox"
	"omnimail/internal/profilemgr"
	"omnimail/internal/syncer"
	"omnimail/services"
)

func main() {
	args := os.Args[1:]
	silent := isSilentAutostart(args)
	initialIntent := extractLaunchIntent(args)

	store := newDefaultStateStore()
	_ = ensureDataLayout(store.getDataDir())
	webviewDir := store.webviewUserDataDir()
	_ = os.MkdirAll(webviewDir, 0o700)

	bus := events.NewBus()
	tokenMgr := oauth.NewTokenManager()
	profMgr := profilemgr.NewManager(store, bus)
	syncMgr := syncer.NewManager(tokenMgr, bus)
	outboxSched := outbox.NewScheduler(tokenMgr, bus)
	outboxSched.SetSentHook(contacts.ExtractFromSent)

	pipeline := services.NewMailPipelineCoordinator(profMgr, outboxSched)
	syncMgr.SetPipelineHooks(pipeline)
	calResponder := services.NewCalendarResponder(outboxSched)
	aiGateway := ai.NewGateway(bus)

	profMgr.RegisterHook(syncMgr)
	profMgr.RegisterHook(outboxSched)

	store.SetMigrationHooks(profMgr.PauseForMigration, profMgr.ResumeAfterMigration)
	_ = profMgr.InitStartup()
	defer profMgr.Close()

	desktopSvc := NewDesktopService(store, initialIntent)
	profileSvc := services.NewProfileService(profMgr)
	accountSvc := services.NewAccountService(profMgr, bus, tokenMgr)
	mailSvc := services.NewMailService(profMgr, bus, tokenMgr)
	composeSvc := services.NewComposeService(profMgr, outboxSched, bus)
	contactSvc := services.NewContactService(profMgr)
	ruleSvc := services.NewRuleService(profMgr, bus)
	aiSvc := services.NewAiService(profMgr, aiGateway)
	diagSvc := services.NewDiagnosticService(profMgr, tokenMgr)

	var appRef *application.App
	app := application.New(application.Options{
		Name:             "OmniMail",
		Description:      "OmniMail 多源统一邮件桌面工作台",
		Icon:             embeddedAppIconPNG,
		FileAssociations: []string{".eml", ".ics"},
		Assets: application.AssetOptions{
			Handler: wrapAssetHandler(application.AssetFileServerFS(assets), profMgr),
		},
		Services: []application.Service{
			application.NewService(desktopSvc),
			application.NewService(profileSvc),
			application.NewService(accountSvc),
			application.NewService(mailSvc),
			application.NewService(composeSvc),
			application.NewService(contactSvc),
			application.NewService(ruleSvc),
			application.NewService(aiSvc),
			application.NewService(diagSvc),
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "com.omnimail.desktop.client",
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				if isQuitExistingRequest(data.Args) {
					desktopSvc.requestQuit()
					if appRef != nil {
						appRef.Quit()
					}
					return
				}
				wakeMainWindow(desktopSvc.mainWindow())
				emitLaunchIntent(appRef, extractLaunchIntent(data.Args))
			},
		},
		Windows: application.WindowsOptions{
			DisableQuitOnLastWindowClosed: true,
			WebviewUserDataPath:           webviewDir,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})
	appRef = app
	bus.BindApp(app)

	prefs := store.readPreferences()
	geom := store.readWindowGeometry()
	quitOnly := isQuitExistingRequest(args)
	hideBoot := quitOnly || shouldHideMainWindowOnBoot(args, prefs)

	startURL := "/"
	if hideBoot {
		startURL = "/?autostart=1&silent=1"
	} else if silent {
		startURL = "/?autostart=1"
	}

	winOpts := application.WebviewWindowOptions{
		Name:                   "main",
		Title:                  "OmniMail",
		Width:                  geom.Width,
		Height:                 geom.Height,
		MinWidth:               minWindowWidth,
		MinHeight:              minWindowHeight,
		Frameless:              true,
		Hidden:                 hideBoot,
		BackgroundColour:       splashWindowBackground(prefs.ResolvedTheme),
		URL:                    startURL,
		OpenInspectorOnStartup: false,
		DevToolsEnabled:        !isProductionBuild,
		InitialPosition:        application.WindowCentered,
		StartState:             application.WindowStateNormal,
	}
	if geom.HasPos {
		winOpts.InitialPosition = application.WindowXY
		winOpts.X = geom.X
		winOpts.Y = geom.Y
	}
	if geom.Maximised && !hideBoot {
		winOpts.StartState = application.WindowStateMaximised
	}

	if quitOnly {
		go func() {
			time.Sleep(80 * time.Millisecond)
			desktopSvc.requestQuit()
			app.Quit()
		}()
	}

	mainWin := app.Window.NewWithOptions(winOpts)
	desktopSvc.bindRuntime(app, mainWin)
	services.AttachProfileRuntime(profileSvc, app, mainWin)
	services.AttachAccountRuntime(accountSvc, app, syncMgr)
	services.AttachMailRuntime(mailSvc, app, mainWin, syncMgr, calResponder)
	services.AttachContactRuntime(contactSvc, app, mainWin)
	services.AttachDiagnosticRuntime(diagSvc, app, mainWin)
	attachWindowLifecycle(app, mainWin, desktopSvc)

	tray := setupSystemTray(app, desktopSvc, profMgr)
	bus.Subscribe(func(name string, _ any) {
		if name == events.ProfileSwitched {
			rebuildTrayMenu(app, tray, desktopSvc, profMgr)
		}
	})
	pipeline.SetNotifier(func(mailID, sender, subject, accountTag string) {
		showPrivacySystemToast("新邮件 · "+sender, accountTag+" · "+subject)
		bus.Emit(events.DesktopIntent, events.DesktopIntentPayload{Type: "new-mail-toast", Payload: mailID})
	})
	syncMgr.SetUnreadCallback(func(unread int) {
		updateTrayUnreadCount(tray, unread)
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
