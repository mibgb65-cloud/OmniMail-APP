package app

import "testing"

func TestMainWindowOptions(t *testing.T) {
	options := mainWindowOptions()
	if !options.Frameless {
		t.Error("自绘控制栏要求关闭原生标题栏")
	}
	if options.Name != "main" || options.Title != "OmniMail" || options.URL != "/" {
		t.Error("主窗口身份或入口发生非预期变化")
	}
	if options.Width != 1750 || options.Height != 950 || options.MinWidth != 860 || options.MinHeight != 600 {
		t.Error("窗口默认尺寸或最小尺寸发生非预期变化")
	}
	if options.DisableResize || options.Windows.DisableFramelessWindowDecorations {
		t.Error("自绘标题栏不应禁用窗口缩放或系统装饰")
	}
}
