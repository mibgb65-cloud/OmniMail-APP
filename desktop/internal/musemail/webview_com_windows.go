//go:build windows

package musemail

import (
	"fmt"
	"math"
	"syscall"
	"unsafe"

	"github.com/wailsapp/go-webview2/pkg/combridge"
	"golang.org/x/sys/windows"
)

type w2ControllerCompletedHandler interface {
	combridge.IUnknown
	ControllerCompleted(errorCode int32, ctrl *w2Controller) uintptr
}

type w2NavStartingHandler interface {
	combridge.IUnknown
	NavigationStarting(sender *w2WebView, args *w2NavArgs) uintptr
}

type w2NewWindowRequestedHandler interface {
	combridge.IUnknown
	NewWindowRequested(sender *w2WebView, args *w2NewWinArgs) uintptr
}

type w2GetCookiesCompletedHandler interface {
	combridge.IUnknown
	CookiesCompleted(errorCode int32, list *w2CookieList) uintptr
}

func init() {
	combridge.RegisterVTable[combridge.IUnknown, w2ControllerCompletedHandler]("{6c4819f3-c9b7-4260-8127-c9f5bde7f68c}", func(this uintptr, errorCode int32, ctrl *w2Controller) uintptr {
		return combridge.Resolve[w2ControllerCompletedHandler](this).ControllerCompleted(errorCode, ctrl)
	})
	combridge.RegisterVTable[combridge.IUnknown, w2NavStartingHandler]("{9adbe429-f36d-432b-9ddc-f8881fbd76e3}", func(this uintptr, sender *w2WebView, args *w2NavArgs) uintptr {
		return combridge.Resolve[w2NavStartingHandler](this).NavigationStarting(sender, args)
	})
	combridge.RegisterVTable[combridge.IUnknown, w2NewWindowRequestedHandler]("{d4c185fe-c81c-4989-97af-2d3fa7ab5651}", func(this uintptr, sender *w2WebView, args *w2NewWinArgs) uintptr {
		return combridge.Resolve[w2NewWindowRequestedHandler](this).NewWindowRequested(sender, args)
	})
	combridge.RegisterVTable[combridge.IUnknown, w2GetCookiesCompletedHandler]("{5a4f5069-5c15-47c3-8646-f3de1fe17011}", func(this uintptr, errorCode int32, list *w2CookieList) uintptr {
		return combridge.Resolve[w2GetCookiesCompletedHandler](this).CookiesCompleted(errorCode, list)
	})
}

func formatHResult(hr uintptr) string { return fmt.Sprintf("0x%08X", uint32(hr)) }

func comAddRef(ptr unsafe.Pointer) {
	if ptr != nil {
		if vtbl := *(**iUnknownVtbl)(ptr); vtbl != nil && vtbl.AddRef != 0 {
			_, _, _ = syscall.SyscallN(vtbl.AddRef, uintptr(ptr))
		}
	}
}

func comRelease(ptr unsafe.Pointer) {
	if ptr != nil {
		if vtbl := *(**iUnknownVtbl)(ptr); vtbl != nil && vtbl.Release != 0 {
			_, _, _ = syscall.SyscallN(vtbl.Release, uintptr(ptr))
		}
	}
}

func envCreateController(env *w2Environment, hwnd windows.Handle, cbRef uintptr) uintptr {
	hr, _, _ := syscall.SyscallN(env.vtbl.CreateCoreWebView2Controller, uintptr(unsafe.Pointer(env)), uintptr(hwnd), cbRef)
	return hr
}

func controllerPutBounds(ctrl *w2Controller, r winRect) {
	if ctrl != nil {
		_, _, _ = syscall.SyscallN(ctrl.vtbl.PutBounds, uintptr(unsafe.Pointer(ctrl)), uintptr(unsafe.Pointer(&r)))
	}
}

func controllerPutDarkBackground(ctrl *w2Controller) {
	if ctrl == nil {
		return
	}
	var ctrl2 *w2Controller2
	if hr, _, _ := syscall.SyscallN(ctrl.vtbl.QueryInterface, uintptr(unsafe.Pointer(ctrl)), uintptr(unsafe.Pointer(&iidICoreWebView2Controller2)), uintptr(unsafe.Pointer(&ctrl2))); int32(hr) >= 0 && ctrl2 != nil {
		defer comRelease(unsafe.Pointer(ctrl2))
		col := w2Color{A: 255, R: 0x1E, G: 0x1F, B: 0x22}
		packed := *(*uint32)(unsafe.Pointer(&col))
		_, _, _ = syscall.SyscallN(ctrl2.vtbl.PutDefaultBackgroundColor, uintptr(unsafe.Pointer(ctrl2)), uintptr(packed))
	}
}

func controllerPutVisible(ctrl *w2Controller, visible bool) {
	if ctrl != nil {
		v := uintptr(0)
		if visible {
			v = 1
		}
		_, _, _ = syscall.SyscallN(ctrl.vtbl.PutIsVisible, uintptr(unsafe.Pointer(ctrl)), v)
	}
}

func controllerGetWebView(ctrl *w2Controller) (*w2WebView, uintptr) {
	var wv *w2WebView
	hr, _, _ := syscall.SyscallN(ctrl.vtbl.GetCoreWebView2, uintptr(unsafe.Pointer(ctrl)), uintptr(unsafe.Pointer(&wv)))
	if int32(hr) < 0 || wv == nil {
		return nil, hr
	}
	return wv, uintptr(windows.S_OK)
}

func queryWebView2(wv *w2WebView) (*w2WebView2, uintptr) {
	if wv == nil {
		return nil, uintptr(windows.E_POINTER)
	}
	var res *w2WebView2
	hr, _, _ := syscall.SyscallN(wv.vtbl.QueryInterface, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(&iidICoreWebView2_2)), uintptr(unsafe.Pointer(&res)))
	if int32(hr) < 0 || res == nil {
		return nil, hr
	}
	return res, uintptr(windows.S_OK)
}

func lockDownWebViewSettings(wv *w2WebView) {
	var s *w2Settings
	if hr, _, _ := syscall.SyscallN(wv.vtbl.GetSettings, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(&s))); int32(hr) >= 0 && s != nil {
		defer comRelease(unsafe.Pointer(s))
		_, _, _ = syscall.SyscallN(s.vtbl.PutAreHostObjectsAllowed, uintptr(unsafe.Pointer(s)), 0)
		_, _, _ = syscall.SyscallN(s.vtbl.PutIsWebMessageEnabled, uintptr(unsafe.Pointer(s)), 0)
		_, _, _ = syscall.SyscallN(s.vtbl.PutAreDevToolsEnabled, uintptr(unsafe.Pointer(s)), 0)
		_, _, _ = syscall.SyscallN(s.vtbl.PutAreDefaultContextMenusEnabled, uintptr(unsafe.Pointer(s)), 0)
		_, _, _ = syscall.SyscallN(s.vtbl.PutIsStatusBarEnabled, uintptr(unsafe.Pointer(s)), 0)
	}
}

func webViewNavigate(wv *w2WebView, rawURL string) uintptr {
	u16, err := windows.UTF16PtrFromString(rawURL)
	if err != nil {
		return uintptr(windows.E_INVALIDARG)
	}
	hr, _, _ := syscall.SyscallN(wv.vtbl.Navigate, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(u16)))
	return hr
}

func readComLPWSTR(fn uintptr, self unsafe.Pointer) string {
	var raw *uint16
	if hr, _, _ := syscall.SyscallN(fn, uintptr(self), uintptr(unsafe.Pointer(&raw))); int32(hr) < 0 || raw == nil {
		return ""
	}
	defer windows.CoTaskMemFree(unsafe.Pointer(raw))
	return windows.UTF16PtrToString(raw)
}

func extractCookieList(list *w2CookieList) []RawCookie {
	var count uint32
	if list == nil {
		return nil
	}
	if hr, _, _ := syscall.SyscallN(list.vtbl.GetCount, uintptr(unsafe.Pointer(list)), uintptr(unsafe.Pointer(&count))); int32(hr) < 0 || count == 0 {
		return nil
	}
	count = min(count, 256)
	out := make([]RawCookie, 0, count)
	for idx := uint32(0); idx < count; idx++ {
		var c *w2Cookie
		if hr, _, _ := syscall.SyscallN(list.vtbl.GetValueAtIndex, uintptr(unsafe.Pointer(list)), uintptr(idx), uintptr(unsafe.Pointer(&c))); int32(hr) < 0 || c == nil {
			continue
		}
		var expBits uint64
		var isSess int32
		selfPtr := unsafe.Pointer(c)
		_, _, _ = syscall.SyscallN(c.vtbl.GetExpires, uintptr(selfPtr), uintptr(unsafe.Pointer(&expBits)))
		_, _, _ = syscall.SyscallN(c.vtbl.GetIsSession, uintptr(selfPtr), uintptr(unsafe.Pointer(&isSess)))
		out = append(out, RawCookie{
			Name: readComLPWSTR(c.vtbl.GetName, selfPtr), Value: readComLPWSTR(c.vtbl.GetValue, selfPtr),
			Domain: readComLPWSTR(c.vtbl.GetDomain, selfPtr), ExpiresAt: math.Float64frombits(expBits), IsSession: isSess != 0,
		})
		comRelease(selfPtr)
	}
	return out
}
