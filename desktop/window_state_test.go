package main

import (
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestMainWindowEstablishesNormalGeometryBeforeRestoringMaximised(t *testing.T) {
	geom := WindowGeometryState{X: 120, Y: 70, Width: 1280, Height: 760, HasPos: true, Maximised: true}
	opts := mainWindowOptions(geom, "light", false, false)
	if opts.StartState != application.WindowStateNormal || opts.InitialPosition != application.WindowXY {
		t.Fatal("原生窗口应先应用普通尺寸与坐标，待 WebView 就绪后再最大化")
	}
	if opts.X != geom.X || opts.Y != geom.Y || opts.Width != geom.Width || opts.Height != geom.Height {
		t.Fatal("普通窗口几何未保留")
	}
	if opts.Hidden || opts.URL != "/" {
		t.Fatal("普通冷启动不应带有静默标记")
	}

	opts = mainWindowOptions(geom, "light", true, true)
	if !opts.Hidden || opts.URL != "/?silent=1" || opts.StartState != application.WindowStateNormal {
		t.Fatal("静默启动应保持窗口隐藏并跳过开屏")
	}
}
