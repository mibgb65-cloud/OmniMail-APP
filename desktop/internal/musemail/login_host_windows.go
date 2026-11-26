//go:build windows

package musemail

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"

	"github.com/wailsapp/go-webview2/pkg/combridge"
	"github.com/wailsapp/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

type cookieReply struct {
	cookies []RawCookie
	err     error
}

type isolatedLoginHost struct {
	hwnd       atomic.Uintptr
	tempDir    string
	alive      atomic.Bool
	closedOnce sync.Once
	doneCh     chan struct{}
	cookieReq  chan chan cookieReply
	staTasks   chan func()

	// 仅在独立 STA 线程内访问的 WebView2 COM 引用与标准 combridge 回调对象
	env        *w2Environment
	ctrl       *w2Controller
	wv         *w2WebView
	ctrlCb     *combridge.ComObject[w2ControllerCompletedHandler]
	navCb      *combridge.ComObject[w2NavStartingHandler]
	newWinCb   *combridge.ComObject[w2NewWindowRequestedHandler]
	cookieCb   *combridge.ComObject[w2GetCookiesCompletedHandler]
	navToken   int64
	winToken   int64
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
		staTasks:  make(chan func(), 4),
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

func (h *isolatedLoginHost) IsAlive() bool {
	return h.alive.Load() && h.hwnd.Load() != 0
}

func (h *isolatedLoginHost) drainSTATasks() {
	for {
		select {
		case fn := <-h.staTasks:
			if fn != nil {
				fn()
			}
		default:
			return
		}
	}
}

func (h *isolatedLoginHost) ExtractMuseCookies(ctx context.Context) ([]RawCookie, error) {
	hwnd := h.hwnd.Load()
	if !h.alive.Load() || hwnd == 0 {
		return nil, errNotLoggedIn()
	}
	replyCh := make(chan cookieReply, 1)
	select {
	case h.cookieReq <- replyCh:
	default:
		return nil, errGatewayFailed("正在核验登录状态，请稍候")
	}
	_, _, _ = procPostMessageW.Call(hwnd, wmAppExtractCookies, 0, 0)

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
		if hwnd := h.hwnd.Load(); hwnd != 0 {
			_, _, _ = procPostMessageW.Call(hwnd, wmAppShutdown, 0, 0)
		}
		select {
		case <-h.doneCh:
		case <-time.After(3 * time.Second):
		}
	})
	return nil
}

func isCoInitSucceeded(err error) bool {
	if err == nil {
		return true
	}
	var errno syscall.Errno
	if errors.As(err, &errno) {
		return errno == 0 || errno == 1 || int32(errno) >= 0
	}
	return false
}

func formatLoaderErrCode(err error) string {
	var errno syscall.Errno
	if errors.As(err, &errno) && errno != 0 {
		return formatHResult(uintptr(errno))
	}
	return ""
}

func (h *isolatedLoginHost) runSTAThread(readyCh chan<- error) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	defer close(h.doneCh)

	coErr := windows.CoInitializeEx(0, windows.COINIT_APARTMENTTHREADED)
	if !isCoInitSucceeded(coErr) {
		removeTempDirWithRetry(h.tempDir, 0)
		readyCh <- errUnsupported(fmt.Sprintf("无法初始化 Windows 独立登录宿主环境（HRESULT %s）", formatLoaderErrCode(coErr)))
		return
	}
	defer func() {
		h.teardownOnSTA()
		windows.CoUninitialize()
		removeTempDirWithRetry(h.tempDir, h.browserPID)
	}()
	hwnd, err := createImmersiveLoginHWND(museLoginWndTitle)
	if err != nil {
		readyCh <- errUnsupported("无法创建独立 Muse 登录窗口")
		return
	}
	h.hwnd.Store(uintptr(hwnd))
	hwndRegistry.Store(hwnd, h)
	err = webviewloader.CreateCoreWebView2EnvironmentWithOptions(
		&envCompletedBridge{host: h, readyCh: readyCh},
		webviewloader.WithUserDataFolder(h.tempDir),
		webviewloader.WithAdditionalBrowserArguments("--disable-features=msWebOOUI,msPdfOOUI --no-first-run --no-default-browser-check"),
	)
	if err != nil {
		_, _, _ = procDestroyWindow.Call(uintptr(hwnd))
		msgTxt := "当前系统未检测到可用的 Microsoft Edge WebView2 运行时"
		if code := formatLoaderErrCode(err); code != "" {
			msgTxt = fmt.Sprintf("无法启动 Microsoft Edge WebView2 运行时（HRESULT %s）", code)
		}
		readyCh <- errUnsupported(msgTxt)
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
