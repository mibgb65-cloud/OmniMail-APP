//go:build windows

package musemail

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wmSize              = 0x0005
	wmClose             = 0x0010
	wmDestroy           = 0x0002
	wmAppExtractCookies = 0x8001
	wmAppShutdown       = 0x8002
	wsOverlappedWindow  = 0x00CF0000
	wsVisible           = 0x10000000
	cwUseDefault        = -0x80000000
	swShow              = 5
	smCxScreen          = 0
	smCyScreen          = 1
	museLoginWndClass   = "OmniMailMuseIsolatedLoginWnd"
)

var (
	modUser32            = windows.NewLazySystemDLL("user32.dll")
	modKernel32          = windows.NewLazySystemDLL("kernel32.dll")
	procRegisterClassExW = modUser32.NewProc("RegisterClassExW")
	procCreateWindowExW  = modUser32.NewProc("CreateWindowExW")
	procDefWindowProcW   = modUser32.NewProc("DefWindowProcW")
	procDestroyWindow    = modUser32.NewProc("DestroyWindow")
	procShowWindow       = modUser32.NewProc("ShowWindow")
	procUpdateWindow     = modUser32.NewProc("UpdateWindow")
	procGetMessageW      = modUser32.NewProc("GetMessageW")
	procTranslateMessage = modUser32.NewProc("TranslateMessage")
	procDispatchMessageW = modUser32.NewProc("DispatchMessageW")
	procPostMessageW     = modUser32.NewProc("PostMessageW")
	procPostQuitMessage  = modUser32.NewProc("PostQuitMessage")
	procGetClientRect    = modUser32.NewProc("GetClientRect")
	procGetSystemMetrics = modUser32.NewProc("GetSystemMetrics")
	procLoadCursorW      = modUser32.NewProc("LoadCursorW")
	procGetModuleHandleW = modKernel32.NewProc("GetModuleHandleW")

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
		wc := wndClassExW{
			Size:       uint32(unsafe.Sizeof(wndClassExW{})),
			WndProc:    syscall.NewCallback(museLoginWndProc),
			Instance:   windows.Handle(hInst),
			Cursor:     windows.Handle(hCursor),
			Background: windows.Handle(6),
			ClassName:  clsName,
		}
		if atom, _, err := procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc))); atom == 0 {
			wndClassErr = err
		}
	})
	return wndClassErr
}

func createCenteredLoginHWND(title string, width, height int32) (windows.Handle, error) {
	if err := ensureLoginWndClass(); err != nil {
		return 0, err
	}
	clsName, _ := windows.UTF16PtrFromString(museLoginWndClass)
	wndTitle, _ := windows.UTF16PtrFromString(title)
	hInst, _, _ := procGetModuleHandleW.Call(0)
	screenW, _, _ := procGetSystemMetrics.Call(smCxScreen)
	screenH, _, _ := procGetSystemMetrics.Call(smCyScreen)
	posX, posY := int32(cwUseDefault), int32(cwUseDefault)
	if int32(screenW) > width && int32(screenH) > height {
		posX = (int32(screenW) - width) / 2
		posY = (int32(screenH) - height) / 2
	}
	hwnd, _, err := procCreateWindowExW.Call(
		0, uintptr(unsafe.Pointer(clsName)), uintptr(unsafe.Pointer(wndTitle)),
		wsOverlappedWindow|wsVisible, uintptr(posX), uintptr(posY), uintptr(width), uintptr(height),
		0, 0, hInst, 0,
	)
	if hwnd == 0 {
		return 0, err
	}
	return windows.Handle(hwnd), nil
}

func museLoginWndProc(hwnd uintptr, msg uint32, wParam, lParam uintptr) uintptr {
	h := windows.Handle(hwnd)
	switch msg {
	case wmSize:
		if v, ok := hwndRegistry.Load(h); ok {
			v.(*isolatedLoginHost).resizeToClient()
		}
		return 0
	case wmAppExtractCookies:
		if v, ok := hwndRegistry.Load(h); ok {
			v.(*isolatedLoginHost).handleExtractCookiesOnSTA()
		}
		return 0
	case wmAppShutdown, wmClose:
		_, _, _ = procDestroyWindow.Call(hwnd)
		return 0
	case wmDestroy:
		hwndRegistry.Delete(h)
		_, _, _ = procPostQuitMessage.Call(0)
		return 0
	}
	ret, _, _ := procDefWindowProcW.Call(hwnd, uintptr(msg), wParam, lParam)
	return ret
}

func deleteAllWebViewCookies(wv *w2WebView) {
	wv2 := queryWebView2(wv)
	if wv2 == nil {
		return
	}
	defer comRelease(unsafe.Pointer(wv2))
	var mgr *w2CookieMgr
	if hr, _, _ := syscall.SyscallN(wv2.vtbl.GetCookieManager, uintptr(unsafe.Pointer(wv2)), uintptr(unsafe.Pointer(&mgr))); windows.Handle(hr) == windows.S_OK && mgr != nil {
		_, _, _ = syscall.SyscallN(mgr.vtbl.DeleteAllCookies, uintptr(unsafe.Pointer(mgr)))
		comRelease(unsafe.Pointer(mgr))
	}
}

func removeTempDirWithRetry(dir string, browserPID uint32) {
	if dir == "" {
		return
	}
	if browserPID != 0 {
		if hProc, err := windows.OpenProcess(windows.SYNCHRONIZE, false, browserPID); err == nil {
			_, _ = windows.WaitForSingleObject(hProc, 900)
			_ = windows.CloseHandle(hProc)
		}
	}
	for i := 0; i < 12; i++ {
		if os.RemoveAll(dir) == nil {
			return
		}
		time.Sleep(80 * time.Millisecond)
	}
}

func sweepStaleMuseWebViewDirs() {
	entries, err := os.ReadDir(os.TempDir())
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), "omnimail-muse-wv2-") {
			_ = os.RemoveAll(filepath.Join(os.TempDir(), e.Name()))
		}
	}
}
