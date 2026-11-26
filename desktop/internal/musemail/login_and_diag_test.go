package musemail

import (
	"context"
	"errors"
	"strings"
	"testing"

	"omnimail/internal/apperr"
)

func TestStageDiagnosticsPreserveStageAndStripSecrets(t *testing.T) {
	rawErr := errors.New(`Get "https://hatch.metaaivm.com/v1/noise?auth_token=ht_secret_999&cookie=hatch_sess%3Dtop_secret": malformed HTTP response "\x00\x00\x12\x04"`)
	wrapped := classifyStageNetErr(stageWSDial, rawErr)
	if apperr.CodeOf(wrapped) != apperr.CodeMuseGatewayFailed {
		t.Fatalf("预期 ERR_MUSE_GATEWAY_FAILED, got: %v", wrapped)
	}
	msg := wrapped.Error()
	if !strings.Contains(msg, "[ws_dial]") || !strings.Contains(msg, "http_protocol_mismatch") {
		t.Fatalf("应包含脱敏阶段标签 [ws_dial] 与简要原因: %s", msg)
	}
	for _, secret := range []string{"ht_secret_999", "top_secret", "hatch_sess", "metaaivm.com/v1"} {
		if strings.Contains(msg, secret) {
			t.Fatalf("脱敏错误不得泄露敏感凭据或完整查询串 (%s): %s", secret, msg)
		}
	}

	expErr := errStageAuthExpired(stageHatchToken, 401)
	if apperr.CodeOf(expErr) != apperr.CodeMuseAuthExpired || !strings.Contains(expErr.Error(), "[hatch_token]") || !strings.Contains(expErr.Error(), "HTTP 401") {
		t.Fatalf("阶段过期错误应包含 [hatch_token] 与 HTTP 401: %v", expErr)
	}

	toErr := classifyStageNetErr(stageNoiseXX, context.DeadlineExceeded)
	if apperr.CodeOf(toErr) != apperr.CodeMuseGatewayTimeout || !strings.Contains(toErr.Error(), "[noise_xx]") {
		t.Fatalf("阶段超时错误应包含 [noise_xx]: %v", toErr)
	}
}

func TestTrustRibbonLayoutAndSmartLoginPosition(t *testing.T) {
	// 100% DPI (96) 与 150% DPI (144) 下顶部 30px 信任条与 WebView2 Bounds 严丝合缝无重叠
	ribbon96, wv96 := computeWebViewClientBounds(winRect{Left: 0, Top: 0, Right: 480, Bottom: 680}, 96)
	if ribbon96.Top != 0 || ribbon96.Bottom != 30 || wv96.Top != 30 || wv96.Bottom != 680 || wv96.Right != 480 {
		t.Fatalf("96 DPI Bounds 偏移错误: ribbon=%+v wv=%+v", ribbon96, wv96)
	}
	ribbon144, wv144 := computeWebViewClientBounds(winRect{Left: 0, Top: 0, Right: 720, Bottom: 1020}, 144)
	if ribbon144.Bottom != 45 || wv144.Top != 45 || wv144.Bottom != 1020 {
		t.Fatalf("144 DPI Bounds 偏移错误: ribbon=%+v wv=%+v", ribbon144, wv144)
	}

	// 智能定位：有主窗口时置于主窗口居中偏左且不越出显示器工作区
	work := winRect{Left: 0, Top: 0, Right: 1920, Bottom: 1040}
	mainRc := winRect{Left: 240, Top: 90, Right: 1680, Bottom: 990}
	px, py := computeSmartLoginPosition(work, &mainRc, 480, 680)
	mainCenterX := (mainRc.Left + mainRc.Right) / 2
	if px < work.Left+12 || px+480 > mainCenterX+60 {
		t.Fatalf("登录窗口应位于主窗口偏左区域避免完全遮挡右侧状态卡: px=%d mainCenterX=%d", px, mainCenterX)
	}
	if py < work.Top+12 || py+680 > work.Bottom-12 {
		t.Fatalf("登录窗口纵向应夹紧在工作区内: py=%d", py)
	}

	// 无主窗口或离屏时回退至工作区居中夹紧
	cx, cy := computeSmartLoginPosition(work, nil, 480, 680)
	if cx != (1920-480)/2 || cy != (1040-680)/2 {
		t.Fatalf("无主窗口时应回退至工作区正中: (%d, %d)", cx, cy)
	}
}

func TestCheckLoginSessionReadyAndAutoCloseLifecycle(t *testing.T) {
	win := newFakeLoginWin(nil)
	connectCalls := 0
	gw := &scriptedGateway{
		emailFn:  func(_ context.Context) (string, error) { return "auto@muse.ai", nil },
		listFn:   func(_ context.Context, _ string) ([]byte, error) { return []byte(`{"data":[]}`), nil },
		threadFn: func(_ context.Context, _ string) ([]byte, error) { return []byte(`{"messages":[]}`), nil },
	}
	mgr := NewManagerWithDeps(
		func() (LoginWindow, error) { return win, nil },
		funcConnector(func(_ context.Context, _ string) (GatewaySession, error) {
			connectCalls++
			return gw, nil
		}),
	)
	sess, cancel := makeProfileSession("auto-flow")
	defer cancel()
	mgr.OnSessionOpened(sess)

	_, err := mgr.BeginConnect(sess)
	if err != nil {
		t.Fatalf("BeginConnect 失败: %v", err)
	}
	p1 := mgr.CheckLoginSessionReady(sess)
	if !p1.WindowOpen || p1.SessionReady || connectCalls != 0 {
		t.Fatalf("未登录时 CheckLoginSessionReady 不应就绪且不得访问外部网关: p1=%+v calls=%d", p1, connectCalls)
	}

	// 模拟用户在 WebView2 输入安全码完成认证，写入 hatch_sess
	win.cookies = []RawCookie{{Name: "hatch_sess", Value: "live_tok", Domain: ".muse.ai", IsSession: true}}
	p2 := mgr.CheckLoginSessionReady(sess)
	if !p2.WindowOpen || !p2.SessionReady || connectCalls != 0 {
		t.Fatalf("出现有效 hatch_sess 后应报告 SessionReady 且仍零外部网关调用: p2=%+v calls=%d", p2, connectCalls)
	}

	// 自动触发一次 VerifyConnection 后，后端应自动关闭独立登录窗
	ver, err := mgr.VerifyConnection(sess)
	if err != nil || ver.Email != "auto@muse.ai" {
		t.Fatalf("VerifyConnection 失败: ver=%+v err=%v", ver, err)
	}
	if win.IsAlive() {
		t.Fatal("VerifyConnection 成功后后端必须自动关闭独立登录窗口")
	}

	st, err := mgr.ConfirmConnection(sess, "")
	if err != nil || !st.Bound || st.AccountName != "Muse" {
		t.Fatalf("空名称确认绑定应默认回退为简洁名称 Muse: st=%+v err=%v", st, err)
	}
}
