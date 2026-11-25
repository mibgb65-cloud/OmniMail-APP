//go:build windows

package musemail

import (
	"context"
	"syscall"
	"testing"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

func TestWebView2VTableOffsetsAndComInitTolerance(t *testing.T) {
	const ptrSize = unsafe.Sizeof(uintptr(0))

	// 对照 go-webview2@v1.0.22/pkg/edge/ICoreWebView2_2.go：
	// ICoreWebView2 共 3(IUnknown) + 58 = 61 个槽位（slot 0..60，RemoveWindowCloseRequested = slot 60）
	if got, want := unsafe.Sizeof(w2WebViewVtbl{})/ptrSize, uintptr(61); got != want {
		t.Fatalf("w2WebViewVtbl 槽位数错误: got %d, want %d (slot 0..60)", got, want)
	}
	var wv w2WebViewVtbl
	if got := unsafe.Offsetof(wv.AddNavigationStarting) / ptrSize; got != 7 {
		t.Fatalf("AddNavigationStarting slot = %d, want 7", got)
	}
	if got := unsafe.Offsetof(wv.AddNewWindowRequested) / ptrSize; got != 44 {
		t.Fatalf("AddNewWindowRequested slot = %d, want 44", got)
	}
	if got := unsafe.Offsetof(wv.RemoveWindowCloseRequested) / ptrSize; got != 60 {
		t.Fatalf("RemoveWindowCloseRequested slot = %d, want 60", got)
	}

	// ICoreWebView2_2 在 slot 61..67 追加 7 个方法：GetCookieManager = slot 66，GetEnvironment = slot 67
	var wv2 w2WebView2Vtbl
	if got := unsafe.Offsetof(wv2.GetCookieManager) / ptrSize; got != 66 {
		t.Fatalf("w2WebView2Vtbl.GetCookieManager slot = %d, want 66", got)
	}
	if got := unsafe.Offsetof(wv2.GetEnvironment) / ptrSize; got != 67 {
		t.Fatalf("w2WebView2Vtbl.GetEnvironment slot = %d, want 67", got)
	}

	var cookieMgr w2CookieMgrVtbl
	if got := unsafe.Offsetof(cookieMgr.GetCookies) / ptrSize; got != 5 {
		t.Fatalf("w2CookieMgrVtbl.GetCookies slot = %d, want 5", got)
	}

	var cookie w2CookieVtbl
	if got := unsafe.Offsetof(cookie.GetIsSession) / ptrSize; got != 16 {
		t.Fatalf("w2CookieVtbl.GetIsSession slot = %d, want 16", got)
	}

	if !isCoInitSucceeded(nil) {
		t.Fatal("nil (S_OK) 必须视为成功")
	}
	if !isCoInitSucceeded(windows.Errno(1)) || !isCoInitSucceeded(syscall.Errno(1)) {
		t.Fatal("S_FALSE (0x1) 复用已初始化 STA 线程时必须视为成功")
	}
	if isCoInitSucceeded(syscall.Errno(0x80010106)) {
		t.Fatal("RPC_E_CHANGED_MODE (0x80010106) 必须视为失败")
	}
}

func TestLoginNavGuardSubdomainsAndOAuthAllowlist(t *testing.T) {
	allowed := []string{
		"about:blank",
		"https://muse.ai/",
		"https://www.muse.ai/inbox",
		"https://login.auth.muse.ai/sso",
		"https://meta.ai/auth",
		"https://auth.meta.com/oauth",
		"https://id.accountscenter.meta.com/verify",
		"https://m.facebook.com/login.php",
		"https://sso.instagram.com/challenge",
		"https://accounts.google.com/o/oauth2/v2/auth",
		"https://appleid.apple.com/auth/authorize",
	}
	for _, u := range allowed {
		if !IsAllowedMuseLoginURL(u) {
			t.Errorf("官方登录跳转地址应被放行: %s", u)
		}
	}

	blocked := []string{
		"",
		"http://muse.ai/",
		"javascript:alert(1)",
		"file:///C:/Windows/win.ini",
		"https://evil-muse.ai/",
		"https://muse.ai.attacker.com/",
		"https://user:pass@muse.ai/",
		"https://sub.accounts.google.com/",
		"https://evil.google.com/",
		"https://example.com/",
	}
	for _, u := range blocked {
		if IsAllowedMuseLoginURL(u) {
			t.Errorf("非白名单或非 HTTPS 地址必须被拦截: %s", u)
		}
	}
}

func TestIsolatedWebView2HostLaunchAndCookieExtractionOnWindows(t *testing.T) {
	win, err := newDefaultLoginWindow()
	if err != nil {
		t.Fatalf("实机创建独立隔离 WebView2 登录宿主失败: %v", err)
	}
	defer func() { _ = win.Close() }()

	if !win.IsAlive() {
		t.Fatal("独立登录窗口创建后应处于 Alive 状态")
	}

	host := win.(*isolatedLoginHost)
	doneSeed := make(chan error, 1)
	host.staTasks <- func() {
		wv2, qhr := queryWebView2(host.wv)
		if wv2 == nil {
			doneSeed <- syscall.Errno(qhr)
			return
		}
		defer comRelease(unsafe.Pointer(wv2))

		var env *w2Environment
		if hr, _, _ := syscall.SyscallN(wv2.vtbl.GetEnvironment, uintptr(unsafe.Pointer(wv2)), uintptr(unsafe.Pointer(&env))); int32(hr) < 0 || env == nil {
			doneSeed <- syscall.Errno(hr)
			return
		}
		ver := readComLPWSTR(env.vtbl.GetBrowserVersionString, unsafe.Pointer(env))
		comRelease(unsafe.Pointer(env))
		if ver == "" {
			doneSeed <- syscall.EINVAL
			return
		}

		var mgr *w2CookieMgr
		if hr, _, _ := syscall.SyscallN(wv2.vtbl.GetCookieManager, uintptr(unsafe.Pointer(wv2)), uintptr(unsafe.Pointer(&mgr))); int32(hr) < 0 || mgr == nil {
			doneSeed <- syscall.Errno(hr)
			return
		}
		defer comRelease(unsafe.Pointer(mgr))

		k, _ := windows.UTF16PtrFromString("hatch_sess")
		v, _ := windows.UTF16PtrFromString("wv2_live_cookie_ok")
		d, _ := windows.UTF16PtrFromString(".muse.ai")
		p, _ := windows.UTF16PtrFromString("/")
		var ck *w2Cookie
		if hr, _, _ := syscall.SyscallN(mgr.vtbl.CreateCookie, uintptr(unsafe.Pointer(mgr)), uintptr(unsafe.Pointer(k)), uintptr(unsafe.Pointer(v)), uintptr(unsafe.Pointer(d)), uintptr(unsafe.Pointer(p)), uintptr(unsafe.Pointer(&ck))); int32(hr) < 0 || ck == nil {
			doneSeed <- syscall.Errno(hr)
			return
		}
		defer comRelease(unsafe.Pointer(ck))
		if hr, _, _ := syscall.SyscallN(mgr.vtbl.AddOrUpdateCookie, uintptr(unsafe.Pointer(mgr)), uintptr(unsafe.Pointer(ck))); int32(hr) < 0 {
			doneSeed <- syscall.Errno(hr)
			return
		}
		doneSeed <- nil
	}
	_, _, _ = procPostMessageW.Call(host.hwnd.Load(), wmAppRunSTA, 0, 0)
	if seedErr := <-doneSeed; seedErr != nil {
		t.Fatalf("STA 线程写入测试 Cookie 或读取 GetEnvironment 失败: %v", seedErr)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cookies, err := win.ExtractMuseCookies(ctx)
	if err != nil {
		t.Fatalf("从真实隔离 WebView2 提取 Cookie 失败（虚表或 COM 回调异常）: %v", err)
	}
	hdr, err := BuildMinimalMuseCookieHeader(cookies, time.Now())
	if err != nil || hdr != "hatch_sess=wv2_live_cookie_ok" {
		t.Fatalf("提取的 hatch_sess Cookie 不匹配: hdr=%q cookies=%+v err=%v", hdr, cookies, err)
	}

	if err := win.Close(); err != nil {
		t.Fatalf("关闭独立登录窗口失败: %v", err)
	}
	if win.IsAlive() {
		t.Fatal("关闭后 IsAlive 应为 false")
	}
}
