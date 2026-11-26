//go:build windows

package musemail

import (
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wmSize              = 0x0005
	wmClose             = 0x0010
	wmDestroy           = 0x0002
	wmAppExtractCookies = 0x8001
	wmAppShutdown       = 0x8002
	wmAppRunSTA         = 0x8003
	csHRedraw           = 0x0002
	csVRedraw           = 0x0001
	wsOverlappedWindow  = 0x00CF0000
	wsMaximizeBox       = 0x00010000
	wsLoginWindowStyle  = wsOverlappedWindow &^ wsMaximizeBox
	swShowNormal        = 1
	smCxScreen          = 0
	smCyScreen          = 1
	hwndTopMost         = ^uintptr(0)     // (HWND)-1
	hwndNoTopMost       = ^uintptr(0) - 1 // (HWND)-2
	swpNoMove           = 0x0002
	swpNoSize           = 0x0001
	swpShowWindow       = 0x0040
	museLoginWndClass   = "OmniMailMuseIsolatedLoginWnd"
	museLoginWndTitle   = "Muse Mail · 官方安全登录"
)

var (
	modUser32               = windows.NewLazySystemDLL("user32.dll")
	modKernel32             = windows.NewLazySystemDLL("kernel32.dll")
	procRegisterClassExW    = modUser32.NewProc("RegisterClassExW")
	procCreateWindowExW     = modUser32.NewProc("CreateWindowExW")
	procDefWindowProcW      = modUser32.NewProc("DefWindowProcW")
	procDestroyWindow       = modUser32.NewProc("DestroyWindow")
	procShowWindow          = modUser32.NewProc("ShowWindow")
	procUpdateWindow        = modUser32.NewProc("UpdateWindow")
	procBringWindowToTop    = modUser32.NewProc("BringWindowToTop")
	procSetForegroundWindow = modUser32.NewProc("SetForegroundWindow")
	procSetWindowPos        = modUser32.NewProc("SetWindowPos")
	procGetMessageW         = modUser32.NewProc("GetMessageW")
	procTranslateMessage    = modUser32.NewProc("TranslateMessage")
	procDispatchMessageW    = modUser32.NewProc("DispatchMessageW")
	procPostMessageW        = modUser32.NewProc("PostMessageW")
	procPostQuitMessage     = modUser32.NewProc("PostQuitMessage")
	procGetClientRect       = modUser32.NewProc("GetClientRect")
	procGetSystemMetrics    = modUser32.NewProc("GetSystemMetrics")
	procLoadCursorW         = modUser32.NewProc("LoadCursorW")
	procGetModuleHandleW    = modKernel32.NewProc("GetModuleHandleW")

	wndClassOnce sync.Once
	wndClassErr  error
	hwndRegistry sync.Map
)

type wndClassExW struct {
	Size, Style                        uint32
	WndProc                            uintptr
	ClsExtra, WndExtra                 int32
	Instance, Icon, Cursor, Background windows.Handle
	MenuName, ClassName                *uint16
	IconSm                             windows.Handle
}

type winMsg struct {
	Hwnd           windows.Handle
	Message        uint32
	WParam, LParam uintptr
	Time           uint32
	PtX, PtY       int32
}

func ensureLoginWndClass() error {
	wndClassOnce.Do(func() {
		clsName, _ := windows.UTF16PtrFromString(museLoginWndClass)
		hInst, _, _ := procGetModuleHandleW.Call(0)
		hCursor, _, _ := procLoadCursorW.Call(0, 32512)
		bigIcon, smIcon := resolveProcessAppIcons()
		bgBrush := sharedDarkWindowBrush()
		if bgBrush == 0 {
			bgBrush = windows.Handle(6)
		}
		wc := wndClassExW{
			Size: uint32(unsafe.Sizeof(wndClassExW{})), Style: csHRedraw | csVRedraw,
			WndProc: syscall.NewCallback(museLoginWndProc), Instance: windows.Handle(hInst),
			Icon: bigIcon, Cursor: windows.Handle(hCursor), Background: bgBrush,
			ClassName: clsName, IconSm: smIcon,
		}
		if atom, _, err := procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc))); atom == 0 {
			wndClassErr = err
		}
	})
	return wndClassErr
}

func createImmersiveLoginHWND(title string) (windows.Handle, error) {
	if err := ensureLoginWndClass(); err != nil {
		return 0, err
	}
	clsName, _ := windows.UTF16PtrFromString(museLoginWndClass)
	wndTitle, _ := windows.UTF16PtrFromString(title)
	hInst, _, _ := procGetModuleHandleW.Call(0)
	posX, posY, width, height := resolveLoginPlacement()
	hwnd, _, err := procCreateWindowExW.Call(0, uintptr(unsafe.Pointer(clsName)), uintptr(unsafe.Pointer(wndTitle)), wsLoginWindowStyle, uintptr(posX), uintptr(posY), uintptr(width), uintptr(height), 0, 0, hInst, 0)
	if hwnd == 0 {
		return 0, err
	}
	h := windows.Handle(hwnd)
	applyImmersiveDarkDwmAttributes(h)
	applyWindowAppIcons(h)
	return h, nil
}

func activateLoginWindowForeground(hwnd windows.Handle) {
	if hwnd != 0 {
		h := uintptr(hwnd)
		_, _, _ = procShowWindow.Call(h, swShowNormal)
		_, _, _ = procUpdateWindow.Call(h)
		_, _, _ = procSetWindowPos.Call(h, hwndTopMost, 0, 0, 0, 0, swpNoMove|swpNoSize|swpShowWindow)
		_, _, _ = procSetWindowPos.Call(h, hwndNoTopMost, 0, 0, 0, 0, swpNoMove|swpNoSize|swpShowWindow)
		_, _, _ = procBringWindowToTop.Call(h)
		_, _, _ = procSetForegroundWindow.Call(h)
	}
}

func museLoginWndProc(hwnd uintptr, msg uint32, wParam, lParam uintptr) uintptr {
	h := windows.Handle(hwnd)
	switch msg {
	case wmGetMinMaxInfo:
		applyMinTrackSize(h, lParam)
		return 0
	case wmDpiChanged:
		applySuggestedDPIRect(hwnd, lParam)
		if v, ok := hwndRegistry.Load(h); ok {
			v.(*isolatedLoginHost).resizeToClient()
		}
		_, _, _ = procInvalidateRect.Call(hwnd, 0, 0)
		return 0
	case wmEraseBkgnd:
		if br := sharedDarkWindowBrush(); br != 0 && wParam != 0 {
			var rc winRect
			if ok, _, _ := procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&rc))); ok != 0 {
				_, _, _ = procFillRect.Call(wParam, uintptr(unsafe.Pointer(&rc)), uintptr(br))
				return 1
			}
		}
	case wmPaint:
		paintTrustRibbon(hwnd)
		return 0
	case wmSize, wmAppExtractCookies, wmAppRunSTA:
		if v, ok := hwndRegistry.Load(h); ok {
			v.(*isolatedLoginHost).dispatchHostMsg(hwnd, msg)
		}
		return 0
	case wmAppShutdown, wmClose:
		_, _, _ = procDestroyWindow.Call(hwnd)
		return 0
	case wmDestroy:
		if v, ok := hwndRegistry.LoadAndDelete(h); ok {
			v.(*isolatedLoginHost).hwnd.Store(0)
		}
		_, _, _ = procPostQuitMessage.Call(0)
		return 0
	}
	ret, _, _ := procDefWindowProcW.Call(hwnd, uintptr(msg), wParam, lParam)
	return ret
}
