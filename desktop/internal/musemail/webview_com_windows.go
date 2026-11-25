//go:build windows

package musemail

import (
	"math"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

type winRect struct {
	Left, Top, Right, Bottom int32
}

type comCallbackVtbl struct {
	iUnknownVtbl
	Invoke uintptr
}

// comCallbackObj 构造仅含指针宽度参数的轻量级 COM 回调对象，兼容纯 Go 零 CGO Win64 ABI。
type comCallbackObj struct {
	vtbl   *comCallbackVtbl
	invoke func(a1, a2 unsafe.Pointer) uintptr
}

var sharedComCallbackVtbl = comCallbackVtbl{
	iUnknownVtbl: iUnknownVtbl{
		QueryInterface: syscall.NewCallback(func(_, _ unsafe.Pointer, out **uintptr) uintptr {
			if out != nil {
				*out = nil
			}
			return uintptr(windows.E_NOINTERFACE)
		}),
		AddRef:  syscall.NewCallback(func(_ unsafe.Pointer) uintptr { return 1 }),
		Release: syscall.NewCallback(func(_ unsafe.Pointer) uintptr { return 1 }),
	},
	Invoke: syscall.NewCallback(func(this *comCallbackObj, a1, a2 unsafe.Pointer) uintptr {
		if this != nil && this.invoke != nil {
			return this.invoke(a1, a2)
		}
		return uintptr(windows.S_OK)
	}),
}

func newComCallback(fn func(a1, a2 unsafe.Pointer) uintptr) *comCallbackObj {
	return &comCallbackObj{vtbl: &sharedComCallbackVtbl, invoke: fn}
}

func comAddRef(ptr unsafe.Pointer) {
	if ptr == nil {
		return
	}
	vtbl := *(**iUnknownVtbl)(ptr)
	if vtbl != nil && vtbl.AddRef != 0 {
		_, _, _ = syscall.SyscallN(vtbl.AddRef, uintptr(ptr))
	}
}

func comRelease(ptr unsafe.Pointer) {
	if ptr == nil {
		return
	}
	vtbl := *(**iUnknownVtbl)(ptr)
	if vtbl != nil && vtbl.Release != 0 {
		_, _, _ = syscall.SyscallN(vtbl.Release, uintptr(ptr))
	}
}

func envCreateController(env *w2Environment, hwnd windows.Handle, cb *comCallbackObj) error {
	hr, _, _ := syscall.SyscallN(env.vtbl.CreateCoreWebView2Controller, uintptr(unsafe.Pointer(env)), uintptr(hwnd), uintptr(unsafe.Pointer(cb)))
	if windows.Handle(hr) != windows.S_OK {
		return syscall.Errno(hr)
	}
	return nil
}

func controllerPutBounds(ctrl *w2Controller, r winRect) {
	if ctrl != nil {
		_, _, _ = syscall.SyscallN(ctrl.vtbl.PutBounds, uintptr(unsafe.Pointer(ctrl)), uintptr(unsafe.Pointer(&r)))
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

func controllerClose(ctrl *w2Controller) {
	if ctrl != nil {
		_, _, _ = syscall.SyscallN(ctrl.vtbl.Close, uintptr(unsafe.Pointer(ctrl)))
	}
}

func controllerGetWebView(ctrl *w2Controller) (*w2WebView, error) {
	var wv *w2WebView
	hr, _, _ := syscall.SyscallN(ctrl.vtbl.GetCoreWebView2, uintptr(unsafe.Pointer(ctrl)), uintptr(unsafe.Pointer(&wv)))
	if windows.Handle(hr) != windows.S_OK || wv == nil {
		return nil, syscall.Errno(hr)
	}
	return wv, nil
}

func queryWebView2(wv *w2WebView) *w2WebView2 {
	if wv == nil {
		return nil
	}
	var res *w2WebView2
	hr, _, _ := syscall.SyscallN(wv.vtbl.QueryInterface, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(&iidICoreWebView2_2)), uintptr(unsafe.Pointer(&res)))
	if windows.Handle(hr) != windows.S_OK {
		return nil
	}
	return res
}

func lockDownWebViewSettings(wv *w2WebView) {
	var s *w2Settings
	hr, _, _ := syscall.SyscallN(wv.vtbl.GetSettings, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(&s)))
	if windows.Handle(hr) != windows.S_OK || s == nil {
		return
	}
	defer comRelease(unsafe.Pointer(s))
	_, _, _ = syscall.SyscallN(s.vtbl.PutAreHostObjectsAllowed, uintptr(unsafe.Pointer(s)), 0)
	_, _, _ = syscall.SyscallN(s.vtbl.PutIsWebMessageEnabled, uintptr(unsafe.Pointer(s)), 0)
	_, _, _ = syscall.SyscallN(s.vtbl.PutAreDevToolsEnabled, uintptr(unsafe.Pointer(s)), 0)
	_, _, _ = syscall.SyscallN(s.vtbl.PutAreDefaultContextMenusEnabled, uintptr(unsafe.Pointer(s)), 0)
	_, _, _ = syscall.SyscallN(s.vtbl.PutIsStatusBarEnabled, uintptr(unsafe.Pointer(s)), 0)
}

func webViewNavigate(wv *w2WebView, rawURL string) error {
	u16, err := windows.UTF16PtrFromString(rawURL)
	if err != nil {
		return err
	}
	hr, _, _ := syscall.SyscallN(wv.vtbl.Navigate, uintptr(unsafe.Pointer(wv)), uintptr(unsafe.Pointer(u16)))
	if windows.Handle(hr) != windows.S_OK {
		return syscall.Errno(hr)
	}
	return nil
}

func readComLPWSTR(fn uintptr, self unsafe.Pointer) string {
	var raw *uint16
	hr, _, _ := syscall.SyscallN(fn, uintptr(self), uintptr(unsafe.Pointer(&raw)))
	if windows.Handle(hr) != windows.S_OK || raw == nil {
		return ""
	}
	defer windows.CoTaskMemFree(unsafe.Pointer(raw))
	return windows.UTF16PtrToString(raw)
}

func extractCookieList(list *w2CookieList) []RawCookie {
	if list == nil {
		return nil
	}
	var count uint32
	hr, _, _ := syscall.SyscallN(list.vtbl.GetCount, uintptr(unsafe.Pointer(list)), uintptr(unsafe.Pointer(&count)))
	if windows.Handle(hr) != windows.S_OK || count == 0 {
		return nil
	}
	if count > 256 {
		count = 256
	}
	out := make([]RawCookie, 0, count)
	for idx := uint32(0); idx < count; idx++ {
		var c *w2Cookie
		hr, _, _ := syscall.SyscallN(list.vtbl.GetValueAtIndex, uintptr(unsafe.Pointer(list)), uintptr(idx), uintptr(unsafe.Pointer(&c)))
		if windows.Handle(hr) != windows.S_OK || c == nil {
			continue
		}
		var expBits uint64
		var isSess int32
		selfPtr := unsafe.Pointer(c)
		_, _, _ = syscall.SyscallN(c.vtbl.GetExpires, uintptr(selfPtr), uintptr(unsafe.Pointer(&expBits)))
		_, _, _ = syscall.SyscallN(c.vtbl.GetIsSession, uintptr(selfPtr), uintptr(unsafe.Pointer(&isSess)))
		out = append(out, RawCookie{
			Name:      readComLPWSTR(c.vtbl.GetName, selfPtr),
			Value:     readComLPWSTR(c.vtbl.GetValue, selfPtr),
			Domain:    readComLPWSTR(c.vtbl.GetDomain, selfPtr),
			ExpiresAt: math.Float64frombits(expBits),
			IsSession: isSess != 0,
		})
		comRelease(selfPtr)
	}
	return out
}
