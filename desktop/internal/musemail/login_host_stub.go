//go:build !windows

package musemail

func newDefaultLoginWindow() (LoginWindow, error) {
	return nil, errUnsupported("独立 WebView2 官方登录窗口仅支持 Windows 桌面环境")
}

func sweepStaleMuseWebViewDirs() {}
