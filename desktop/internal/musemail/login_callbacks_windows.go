//go:build windows

package musemail

import (
	"fmt"
	"syscall"
	"unsafe"

	"github.com/wailsapp/go-webview2/pkg/combridge"
	"github.com/wailsapp/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

func notifyReadyErr(ch chan<- error, hwnd uintptr, err error) {
	select {
	case ch <- err:
	default:
	}
	if err != nil && hwnd != 0 {
		_, _, _ = procDestroyWindow.Call(hwnd)
	}
}

type ctrlCompletedImpl struct {
	host    *isolatedLoginHost
	readyCh chan<- error
}
type navStartingImpl struct{}
type newWindowImpl struct{}
type cookiesCompletedImpl struct{ host *isolatedLoginHost }
type envCompletedBridge struct {
	host    *isolatedLoginHost
	readyCh chan<- error
}

func (b *envCompletedBridge) EnvironmentCompleted(errorCode webviewloader.HRESULT, env *webviewloader.ICoreWebView2Environment) webviewloader.HRESULT {
	hwnd := b.host.hwnd.Load()
	if errorCode < 0 || env == nil {
		notifyReadyErr(b.readyCh, hwnd, errUnsupported(fmt.Sprintf("初始化独立 WebView2 登录环境失败（HRESULT %s）", formatHResult(uintptr(uint32(errorCode))))))
		return webviewloader.HRESULT(windows.S_OK)
	}
	env.AddRef()
	b.host.env = (*w2Environment)(unsafe.Pointer(env))
	b.host.ctrlCb = combridge.New[w2ControllerCompletedHandler](&ctrlCompletedImpl{host: b.host, readyCh: b.readyCh})
	if hr := envCreateController(b.host.env, windows.Handle(hwnd), b.host.ctrlCb.Ref()); int32(hr) < 0 {
		notifyReadyErr(b.readyCh, hwnd, errUnsupported(fmt.Sprintf("创建独立 WebView2 控制器失败（HRESULT %s）", formatHResult(hr))))
	}
	return webviewloader.HRESULT(windows.S_OK)
}

func (c *ctrlCompletedImpl) ControllerCompleted(errorCode int32, ctrl *w2Controller) uintptr {
	return c.host.onControllerCompleted(errorCode, ctrl, c.readyCh)
}

func (*navStartingImpl) NavigationStarting(_ *w2WebView, args *w2NavArgs) uintptr {
	if args != nil && !IsAllowedMuseLoginURL(readComLPWSTR(args.vtbl.GetUri, unsafe.Pointer(args))) {
		_, _, _ = syscall.SyscallN(args.vtbl.PutCancel, uintptr(unsafe.Pointer(args)), 1)
	}
	return uintptr(windows.S_OK)
}

func (*newWindowImpl) NewWindowRequested(sender *w2WebView, args *w2NewWinArgs) uintptr {
	if args != nil {
		uri := readComLPWSTR(args.vtbl.GetUri, unsafe.Pointer(args))
		_, _, _ = syscall.SyscallN(args.vtbl.PutHandled, uintptr(unsafe.Pointer(args)), 1)
		if sender != nil && uri != "" && uri != "about:blank" && IsAllowedMuseLoginURL(uri) {
			_ = webViewNavigate(sender, uri)
		}
	}
	return uintptr(windows.S_OK)
}

func (c *cookiesCompletedImpl) CookiesCompleted(errorCode int32, list *w2CookieList) uintptr {
	if req := c.host.activeReq; req != nil {
		c.host.activeReq = nil
		if errorCode < 0 || list == nil {
			req <- cookieReply{err: errGatewayFailed(fmt.Sprintf("读取登录会话状态失败（HRESULT %s）", formatHResult(uintptr(uint32(errorCode)))))}
		} else {
			req <- cookieReply{cookies: extractCookieList(list)}
		}
	}
	return uintptr(windows.S_OK)
}

func (h *isolatedLoginHost) onControllerCompleted(errorCode int32, ctrl *w2Controller, readyCh chan<- error) uintptr {
	hwnd := h.hwnd.Load()
	if errorCode < 0 || ctrl == nil {
		notifyReadyErr(readyCh, hwnd, errUnsupported(fmt.Sprintf("无法绑定独立登录视图控制器（HRESULT %s）", formatHResult(uintptr(uint32(errorCode))))))
		return uintptr(windows.S_OK)
	}
	comAddRef(unsafe.Pointer(ctrl))
	h.ctrl = ctrl
	wv, hr := controllerGetWebView(ctrl)
	if wv == nil {
		notifyReadyErr(readyCh, hwnd, errUnsupported(fmt.Sprintf("无法获取独立登录内核实例（HRESULT %s）", formatHResult(hr))))
		return uintptr(windows.S_OK)
	}
	h.wv = wv
	_, _, _ = syscall.SyscallN(wv.vtbl.GetBrowserProcessId, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(&h.browserPID)))
	lockDownWebViewSettings(wv)
	h.attachGuards(wv)
	h.resizeToClient()
	controllerPutVisible(ctrl, true)
	activateLoginWindowForeground(windows.Handle(hwnd))
	if navHR := webViewNavigate(wv, museLoginStartURL); int32(navHR) < 0 {
		notifyReadyErr(readyCh, hwnd, errGatewayFailed(fmt.Sprintf("打开 Muse 官方登录页面失败（HRESULT %s）", formatHResult(navHR))))
		return uintptr(windows.S_OK)
	}
	h.alive.Store(true)
	notifyReadyErr(readyCh, 0, nil)
	return uintptr(windows.S_OK)
}

func (h *isolatedLoginHost) attachGuards(wv *w2WebView) {
	h.navCb = combridge.New[w2NavStartingHandler](&navStartingImpl{})
	h.newWinCb = combridge.New[w2NewWindowRequestedHandler](&newWindowImpl{})
	_, _, _ = syscall.SyscallN(wv.vtbl.AddNavigationStarting, uintptr(unsafe.Pointer(wv)), h.navCb.Ref(), uintptr(unsafe.Pointer(&h.navToken)))
	_, _, _ = syscall.SyscallN(wv.vtbl.AddNewWindowRequested, uintptr(unsafe.Pointer(wv)), h.newWinCb.Ref(), uintptr(unsafe.Pointer(&h.winToken)))
}

func (h *isolatedLoginHost) resizeToClient() {
	var rc winRect
	if hwnd := h.hwnd.Load(); h.ctrl != nil && hwnd != 0 {
		if ret, _, _ := procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&rc))); ret != 0 {
			controllerPutBounds(h.ctrl, rc)
		}
	}
}

func (h *isolatedLoginHost) handleExtractCookiesOnSTA() {
	var replyCh chan cookieReply
	select {
	case replyCh = <-h.cookieReq:
	default:
		return
	}
	wv2, qhr := queryWebView2(h.wv)
	if wv2 == nil {
		replyCh <- cookieReply{err: errGatewayFailed(fmt.Sprintf("读取隔离内核接口失败（HRESULT %s）", formatHResult(qhr)))}
		return
	}
	defer comRelease(unsafe.Pointer(wv2))
	var mgr *w2CookieMgr
	if hr, _, _ := syscall.SyscallN(wv2.vtbl.GetCookieManager, uintptr(unsafe.Pointer(wv2)), uintptr(unsafe.Pointer(&mgr))); int32(hr) < 0 || mgr == nil {
		replyCh <- cookieReply{err: errGatewayFailed(fmt.Sprintf("无法获取隔离会话管理器（HRESULT %s）", formatHResult(hr)))}
		return
	}
	defer comRelease(unsafe.Pointer(mgr))
	h.activeReq = replyCh
	if h.cookieCb == nil {
		h.cookieCb = combridge.New[w2GetCookiesCompletedHandler](&cookiesCompletedImpl{host: h})
	}
	uriPtr, _ := windows.UTF16PtrFromString("https://muse.ai")
	if hr, _, _ := syscall.SyscallN(mgr.vtbl.GetCookies, uintptr(unsafe.Pointer(mgr)), uintptr(unsafe.Pointer(uriPtr)), h.cookieCb.Ref()); int32(hr) < 0 {
		h.activeReq = nil
		replyCh <- cookieReply{err: errGatewayFailed(fmt.Sprintf("请求登录会话状态失败（HRESULT %s）", formatHResult(hr)))}
	}
}

func (h *isolatedLoginHost) teardownOnSTA() {
	h.alive.Store(false)
	if h.activeReq != nil {
		h.activeReq <- cookieReply{err: errCancelled()}
		h.activeReq = nil
	}
	if h.wv != nil {
		if h.navToken != 0 {
			_, _, _ = syscall.SyscallN(h.wv.vtbl.RemoveNavigationStarting, uintptr(unsafe.Pointer(h.wv)), uintptr(h.navToken))
		}
		if h.winToken != 0 {
			_, _, _ = syscall.SyscallN(h.wv.vtbl.RemoveNewWindowRequested, uintptr(unsafe.Pointer(h.wv)), uintptr(h.winToken))
		}
		deleteAllWebViewCookies(h.wv)
		comRelease(unsafe.Pointer(h.wv))
		h.wv = nil
	}
	if h.ctrl != nil {
		controllerClose(h.ctrl)
		comRelease(unsafe.Pointer(h.ctrl))
		h.ctrl = nil
	}
	if h.env != nil {
		comRelease(unsafe.Pointer(h.env))
		h.env = nil
	}
	if h.cookieCb != nil {
		_ = h.cookieCb.Close()
	}
	if h.newWinCb != nil {
		_ = h.newWinCb.Close()
	}
	if h.navCb != nil {
		_ = h.navCb.Close()
	}
	if h.ctrlCb != nil {
		_ = h.ctrlCb.Close()
	}
	h.cookieCb, h.newWinCb, h.navCb, h.ctrlCb = nil, nil, nil, nil
}
