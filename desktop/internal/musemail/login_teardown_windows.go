//go:build windows

package musemail

import (
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

func releaseWebViewAndGuards(h *isolatedLoginHost) {
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
		_, _, _ = syscall.SyscallN(h.ctrl.vtbl.Close, uintptr(unsafe.Pointer(h.ctrl)))
		comRelease(unsafe.Pointer(h.ctrl))
		h.ctrl = nil
	}
	if h.env != nil {
		comRelease(unsafe.Pointer(h.env))
		h.env = nil
	}
}

func deleteAllWebViewCookies(wv *w2WebView) {
	if wv2, _ := queryWebView2(wv); wv2 != nil {
		defer comRelease(unsafe.Pointer(wv2))
		var mgr *w2CookieMgr
		if hr, _, _ := syscall.SyscallN(wv2.vtbl.GetCookieManager, uintptr(unsafe.Pointer(wv2)), uintptr(unsafe.Pointer(&mgr))); int32(hr) >= 0 && mgr != nil {
			_, _, _ = syscall.SyscallN(mgr.vtbl.DeleteAllCookies, uintptr(unsafe.Pointer(mgr)))
			comRelease(unsafe.Pointer(mgr))
		}
	}
}

func releaseComCallbacks(h *isolatedLoginHost) {
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
	for i := 0; i < 12 && os.RemoveAll(dir) != nil; i++ {
		time.Sleep(80 * time.Millisecond)
	}
}

func sweepStaleMuseWebViewDirs() {
	entries, _ := os.ReadDir(os.TempDir())
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), "omnimail-muse-wv2-") {
			_ = os.RemoveAll(filepath.Join(os.TempDir(), e.Name()))
		}
	}
}
