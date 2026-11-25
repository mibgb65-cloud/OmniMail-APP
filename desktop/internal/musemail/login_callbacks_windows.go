//go:build windows

package musemail

import (
	"syscall"
	"unsafe"

	"github.com/wailsapp/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

func notifyReadyErr(ch chan<- error, hwnd windows.Handle, err error) {
	select {
	case ch <- err:
	default:
	}
	if err != nil && hwnd != 0 {
		_, _, _ = procDestroyWindow.Call(uintptr(hwnd))
	}
}

type envCompletedBridge struct {
	host    *isolatedLoginHost
	readyCh chan<- error
}

func (b *envCompletedBridge) EnvironmentCompleted(errorCode webviewloader.HRESULT, env *webviewloader.ICoreWebView2Environment) webviewloader.HRESULT {
	if windows.Handle(errorCode) != windows.S_OK || env == nil {
		notifyReadyErr(b.readyCh, b.host.hwnd, errUnsupported("初始化独立 WebView2 登录环境失败"))
		return webviewloader.HRESULT(windows.S_OK)
	}
	env.AddRef()
	b.host.env = (*w2Environment)(unsafe.Pointer(env))
	b.host.ctrlCb = newComCallback(func(errHR, ctrlPtr unsafe.Pointer) uintptr {
		return b.host.onControllerCompleted(uintptr(errHR), (*w2Controller)(ctrlPtr), b.readyCh)
	})
	if err := envCreateController(b.host.env, b.host.hwnd, b.host.ctrlCb); err != nil {
		notifyReadyErr(b.readyCh, b.host.hwnd, errUnsupported("创建独立 WebView2 控制器失败"))
	}
	return webviewloader.HRESULT(windows.S_OK)
}

func (h *isolatedLoginHost) onControllerCompleted(errorCode uintptr, ctrl *w2Controller, readyCh chan<- error) uintptr {
	if windows.Handle(errorCode) != windows.S_OK || ctrl == nil {
		notifyReadyErr(readyCh, h.hwnd, errUnsupported("无法绑定独立登录视图控制器"))
		return uintptr(windows.S_OK)
	}
	comAddRef(unsafe.Pointer(ctrl))
	h.ctrl = ctrl
	wv, err := controllerGetWebView(ctrl)
	if err != nil {
		notifyReadyErr(readyCh, h.hwnd, errUnsupported("无法获取独立登录内核实例"))
		return uintptr(windows.S_OK)
	}
	h.wv = wv
	_, _, _ = syscall.SyscallN(wv.vtbl.GetBrowserProcessId, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(&h.browserPID)))
	lockDownWebViewSettings(wv)
	h.attachGuards(wv)
	h.resizeToClient()
	controllerPutVisible(ctrl, true)
	if err := webViewNavigate(wv, museLoginStartURL); err != nil {
		notifyReadyErr(readyCh, h.hwnd, errGatewayFailed("打开 Muse 官方登录页面失败"))
		return uintptr(windows.S_OK)
	}
	h.alive.Store(true)
	notifyReadyErr(readyCh, 0, nil)
	return uintptr(windows.S_OK)
}

func (h *isolatedLoginHost) attachGuards(wv *w2WebView) {
	var navTok, winTok int64
	h.navCb = newComCallback(func(_, argsPtr unsafe.Pointer) uintptr {
		if argsPtr != nil {
			args := (*w2NavArgs)(argsPtr)
			if !IsAllowedMuseLoginURL(readComLPWSTR(args.vtbl.GetUri, argsPtr)) {
				_, _, _ = syscall.SyscallN(args.vtbl.PutCancel, uintptr(argsPtr), 1)
			}
		}
		return uintptr(windows.S_OK)
	})
	h.newWinCb = newComCallback(func(senderPtr, argsPtr unsafe.Pointer) uintptr {
		if argsPtr != nil {
			args := (*w2NewWinArgs)(argsPtr)
			uri := readComLPWSTR(args.vtbl.GetUri, argsPtr)
			_, _, _ = syscall.SyscallN(args.vtbl.PutHandled, uintptr(argsPtr), 1)
			if senderPtr != nil && uri != "" && uri != "about:blank" && IsAllowedMuseLoginURL(uri) {
				_ = webViewNavigate((*w2WebView)(senderPtr), uri)
			}
		}
		return uintptr(windows.S_OK)
	})
	_, _, _ = syscall.SyscallN(wv.vtbl.AddNavigationStarting, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(h.navCb)), uintptr(unsafe.Pointer(&navTok)))
	_, _, _ = syscall.SyscallN(wv.vtbl.AddNewWindowRequested, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(h.newWinCb)), uintptr(unsafe.Pointer(&winTok)))
}

func (h *isolatedLoginHost) resizeToClient() {
	var rc winRect
	if h.ctrl != nil && h.hwnd != 0 {
		if ret, _, _ := procGetClientRect.Call(uintptr(h.hwnd), uintptr(unsafe.Pointer(&rc))); ret != 0 {
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
	wv2 := queryWebView2(h.wv)
	if wv2 == nil {
		replyCh <- cookieReply{err: errNotLoggedIn()}
		return
	}
	defer comRelease(unsafe.Pointer(wv2))
	var mgr *w2CookieMgr
	if hr, _, _ := syscall.SyscallN(wv2.vtbl.GetCookieManager, uintptr(unsafe.Pointer(wv2)), uintptr(unsafe.Pointer(&mgr))); windows.Handle(hr) != windows.S_OK || mgr == nil {
		replyCh <- cookieReply{err: errGatewayFailed("无法获取隔离会话管理器")}
		return
	}
	defer comRelease(unsafe.Pointer(mgr))
	h.activeReq = replyCh
	if h.cookieCb == nil {
		h.cookieCb = newComCallback(func(errHR, listPtr unsafe.Pointer) uintptr {
			req := h.activeReq
			h.activeReq = nil
			if req != nil {
				if windows.Handle(uintptr(errHR)) != windows.S_OK || listPtr == nil {
					req <- cookieReply{err: errGatewayFailed("读取登录会话状态失败")}
				} else {
					req <- cookieReply{cookies: extractCookieList((*w2CookieList)(listPtr))}
				}
			}
			return uintptr(windows.S_OK)
		})
	}
	uriPtr, _ := windows.UTF16PtrFromString("https://muse.ai")
	if hr, _, _ := syscall.SyscallN(mgr.vtbl.GetCookies, uintptr(unsafe.Pointer(mgr)), uintptr(unsafe.Pointer(uriPtr)), uintptr(unsafe.Pointer(h.cookieCb))); windows.Handle(hr) != windows.S_OK {
		h.activeReq = nil
		replyCh <- cookieReply{err: errGatewayFailed("请求登录会话状态失败")}
	}
}

func (h *isolatedLoginHost) teardownOnSTA() {
	h.alive.Store(false)
	if h.activeReq != nil {
		h.activeReq <- cookieReply{err: errCancelled()}
		h.activeReq = nil
	}
	if h.wv != nil {
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
}
