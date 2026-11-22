package main

import (
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func main() {
	app := application.New(application.Options{
		Name:        "OmniMail",
		Description: "OmniMail 桌面开发预览",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Services: []application.Service{
			application.NewService(&DesktopService{}),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "OmniMail",
		Width:            1440,
		Height:           900,
		MinWidth:         960,
		MinHeight:        640,
		Frameless:        true,
		BackgroundColour: application.NewRGB(239, 242, 246),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
