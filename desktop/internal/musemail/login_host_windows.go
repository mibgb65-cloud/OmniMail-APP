//go:build windows

package musemail

import (
	"context"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/wailsapp/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

type cookieReply struct {
	cookies []RawCookie
	err     error
}

type isolatedLoginHost struct {
	hwnd       windows.Handle
	tempDir    string
	alive      atomic.Bool
	closedOnce sync.Once
	doneCh     chan struct{}
	cookieReq  chan chan cookieReply

	// 仅在独立 STA 线程内访问的 WebView2 COM 引用与固定回调（防止 GC 回收回调结构体）
	env        *w2Environment
	ctrl       *w2Controller
	wv         *w2WebView
	ctrlCb     *comCallbackObj
	navCb      *comCallbackObj
	newWinCb   *comCallbackObj
	cookieCb   *comCallbackObj
	activeReq  chan cookieReply
	browserPID uint32
}

func newDefaultLoginWindow() (LoginWindow, error) {
	sweepStaleMuseWebViewDirs()
	tempDir, err := os.MkdirTemp("", "omnimail-muse-wv2-*")
	if err != nil {
		return nil, errUnsupported("无法创建独立登录会话隔离目录")
	}
	_ = os.Chmod(tempDir, 0o700)

	host := &isolatedLoginHost{
		tempDir:   tempDir,
		doneCh:    make(chan struct{}),
		cookieReq: make(chan chan cookieReply, 1),
	}
	readyCh := make(chan error, 1)
	go host.runSTAThread(readyCh)

	select {
	case initErr := <-readyCh:
		if initErr != nil {
			_ = host.Close()
			return nil, initErr
		}
		return host, nil
	case <-time.After(15 * time.Second):
		_ = host.Close()
		return nil, errGatewayTimeout()
	}
}

func (h *isolatedLoginHost) IsAlive() bool { return h.alive.Load() }

func (h *isolatedLoginHost) ExtractMuseCookies(ctx context.Context) ([]RawCookie, error) {
	if !h.alive.Load() {
		return nil, errNotLoggedIn()
	}
	replyCh := make(chan cookieReply, 1)
	select {
	case h.cookieReq <- replyCh:
	default:
		return nil, errGatewayFailed("正在核验登录状态，请稍候")
	}
	_, _, _ = procPostMessageW.Call(uintptr(h.hwnd), wmAppExtractCookies, 0, 0)

	select {
	case res := <-replyCh:
		return res.cookies, res.err
	case <-h.doneCh:
		return nil, errNotLoggedIn()
	case <-ctx.Done():
		return nil, classifyContextOrNetErr(ctx.Err())
	}
}

func (h *isolatedLoginHost) Close() error {
	h.closedOnce.Do(func() {
		if h.alive.Load() && h.hwnd != 0 {
			_, _, _ = procPostMessageW.Call(uintptr(h.hwnd), wmAppShutdown, 0, 0)
		}
		select {
		case <-h.doneCh:
		case <-time.After(3 * time.Second):
		}
	})
	return nil
}

func (h *isolatedLoginHost) runSTAThread(readyCh chan<- error) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	defer close(h.doneCh)

	if err := windows.CoInitializeEx(0, windows.COINIT_APARTMENTTHREADED); err != nil {
		removeTempDirWithRetry(h.tempDir, 0)
		readyCh <- errUnsupported("无法初始化 Windows 独立登录宿主环境")
		return
	}
	defer func() {
		h.teardownOnSTA()
		windows.CoUninitialize()
		removeTempDirWithRetry(h.tempDir, h.browserPID)
	}()

	hwnd, err := createCenteredLoginHWND("Muse Mail · 官方安全登录", 540, 720)
	if err != nil {
		readyCh <- errUnsupported("无法创建独立 Muse 登录窗口")
		return
	}
	h.hwnd = hwnd
	hwndRegistry.Store(hwnd, h)
	_, _, _ = procShowWindow.Call(uintptr(hwnd), swShow)
	_, _, _ = procUpdateWindow.Call(uintptr(hwnd))

	err = webviewloader.CreateCoreWebView2EnvironmentWithOptions(
		&envCompletedBridge{host: h, readyCh: readyCh},
		webviewloader.WithUserDataFolder(h.tempDir),
		webviewloader.WithExclusiveUserDataFolderAccess(true),
		webviewloader.WithAdditionalBrowserArguments("--disable-features=msWebOOUI,msPdfOOUI --no-first-run --no-default-browser-check"),
	)
	if err != nil {
		_, _, _ = procDestroyWindow.Call(uintptr(hwnd))
		readyCh <- errUnsupported("当前系统未检测到可用的 Microsoft Edge WebView2 运行时")
		return
	}

	var msg winMsg
	for {
		ret, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(ret) <= 0 {
			break
		}
		_, _, _ = procTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		_, _, _ = procDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
	}
}
