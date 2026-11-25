package musemail

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/flynn/noise"

	"omnimail/internal/apperr"
)

func TestGatewayHandshakeNormalAndChunkedReassembly(t *testing.T) {
	fg := startFakeMuseGateway(t, func(t *testing.T, ws *websocket.Conn, sendCS *noise.CipherState, sid int64, req appRequestMsg) {
		switch req.Path {
		case "/api/email/mailbox":
			sr := encodeTestResponseFrame(sid, 200, []byte(`{"ok":true,"result":{"address":"Alice@muse.ai"}}`), true)
			sendEncryptedTransport(ws, sendCS, transportFrame{ChunkID: 10, ChunkIndex: 0, TotalChunks: 1, Payload: sr})
		case "/api/email/threads?cursor=cur_1":
			sr := encodeTestResponseFrame(sid, 200, []byte(`{"data":[{"id":"thd_1","subject":"Hello Muse","message_count":2,"last_message":{"header_from":"bob@example.com","preview":"chunked ok"}}],"paging":{"cursors":{"after":"cur_2"}}}`), true)
			mid := len(sr) / 2
			sendEncryptedTransport(ws, sendCS, transportFrame{ChunkID: 77, ChunkIndex: 1, TotalChunks: 2, Payload: sr[mid:]})
			sendEncryptedTransport(ws, sendCS, transportFrame{ChunkID: 77, ChunkIndex: 0, TotalChunks: 2, Payload: sr[:mid]})
		}
	})

	sess, err := fg.connector().Connect(context.Background(), "hatch_sess=valid_sess; datr=abc")
	if err != nil {
		t.Fatalf("Connect 失败: %v", err)
	}
	defer sess.Close()

	email, err := sess.GetMailboxEmail(context.Background())
	if err != nil || email != "alice@muse.ai" {
		t.Fatalf("GetMailboxEmail 异常: email=%q err=%v", email, err)
	}

	raw, err := sess.ListThreadsRaw(context.Background(), "cur_1")
	if err != nil {
		t.Fatalf("分片重组 ListThreadsRaw 失败: %v", err)
	}
	rows, next, err := parseThreadListPayload(raw)
	if err != nil || len(rows) != 1 || rows[0].ID != "thd_1" || next != "cur_2" {
		t.Fatalf("分片重组解析结果不符: rows=%+v next=%q err=%v", rows, next, err)
	}
}

func TestGatewayEmailNotEnabledAndErrorSanitization(t *testing.T) {
	fg := startFakeMuseGateway(t, func(t *testing.T, ws *websocket.Conn, sendCS *noise.CipherState, sid int64, _ appRequestMsg) {
		sr := encodeTestResponseFrame(sid, 403, []byte(`{"code":"email_not_enabled","debug":"internal_secret_trace"}`), true)
		sendEncryptedTransport(ws, sendCS, transportFrame{ChunkID: 1, ChunkIndex: 0, TotalChunks: 1, Payload: sr})
	})

	sess, err := fg.connector().Connect(context.Background(), "hatch_sess=valid_sess")
	if err != nil {
		t.Fatalf("Connect 失败: %v", err)
	}
	defer sess.Close()

	_, err = sess.GetMailboxEmail(context.Background())
	if apperr.CodeOf(err) != apperr.CodeMuseNotEnabled {
		t.Fatalf("403 email_not_enabled 应映射为 ERR_MUSE_NOT_ENABLED: %v", err)
	}
	if strings.Contains(err.Error(), "internal_secret_trace") {
		t.Fatalf("错误信息泄露上游原始报文: %v", err)
	}

	_, authErr := fg.connector().Connect(context.Background(), "hatch_sess=expired_sess")
	if apperr.CodeOf(authErr) != apperr.CodeMuseAuthExpired {
		t.Fatalf("401 会话过期应映射为 ERR_MUSE_AUTH_EXPIRED: %v", authErr)
	}
	if strings.Contains(authErr.Error(), "sensitive_raw_cookie_leak_check") {
		t.Fatalf("认证错误泄露上游原始报文: %v", authErr)
	}
}

func TestGatewayIncompleteChunksDisconnectTimeoutAndOversize(t *testing.T) {
	t.Run("incomplete_chunks_and_disconnect", func(t *testing.T) {
		fg := startFakeMuseGateway(t, func(t *testing.T, ws *websocket.Conn, sendCS *noise.CipherState, sid int64, _ appRequestMsg) {
			sr := encodeTestResponseFrame(sid, 200, []byte(`{"address":"a@muse.ai"}`), true)
			sendEncryptedTransport(ws, sendCS, transportFrame{ChunkID: 99, ChunkIndex: 0, TotalChunks: 3, Payload: sr[:6]})
			_ = ws.CloseNow()
		})
		sess, err := fg.connector().Connect(context.Background(), "hatch_sess=valid_sess")
		if err != nil {
			t.Fatal(err)
		}
		defer sess.Close()
		if _, err := sess.GetMailboxEmail(context.Background()); apperr.CodeOf(err) != apperr.CodeMuseGatewayFailed {
			t.Fatalf("不完整分片断线应返回 ERR_MUSE_GATEWAY_FAILED: %v", err)
		}
	})

	t.Run("oversized_cumulative_response", func(t *testing.T) {
		fg := startFakeMuseGateway(t, func(t *testing.T, ws *websocket.Conn, sendCS *noise.CipherState, sid int64, _ appRequestMsg) {
			head := encodeTestResponseFrame(sid, 200, []byte(`{"data":"`), false)
			sendEncryptedTransport(ws, sendCS, transportFrame{ChunkID: 1, ChunkIndex: 0, TotalChunks: 1, Payload: head})
			big := bytes.Repeat([]byte("A"), 48*1024)
			for i := 0; i < 95; i++ {
				ch := encodeTestBodyChunkFrame(sid, big, i == 94)
				sendEncryptedTransport(ws, sendCS, transportFrame{ChunkID: int64(i + 2), ChunkIndex: 0, TotalChunks: 1, Payload: ch})
			}
		})
		sess, err := fg.connector().Connect(context.Background(), "hatch_sess=valid_sess")
		if err != nil {
			t.Fatal(err)
		}
		defer sess.Close()
		if _, err := sess.ListThreadsRaw(context.Background(), ""); apperr.CodeOf(err) != apperr.CodeMuseGatewayFailed {
			t.Fatalf("累计响应超限应立即阻断并返回 ERR_MUSE_GATEWAY_FAILED: %v", err)
		}
	})

	t.Run("request_timeout", func(t *testing.T) {
		fg := startFakeMuseGateway(t, func(_ *testing.T, _ *websocket.Conn, _ *noise.CipherState, _ int64, _ appRequestMsg) {
			time.Sleep(250 * time.Millisecond)
		})
		sess, err := fg.connector().Connect(context.Background(), "hatch_sess=valid_sess")
		if err != nil {
			t.Fatal(err)
		}
		defer sess.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Millisecond)
		defer cancel()
		if _, err := sess.GetMailboxEmail(ctx); apperr.CodeOf(err) != apperr.CodeMuseGatewayTimeout {
			t.Fatalf("超时应映射为 ERR_MUSE_GATEWAY_TIMEOUT: %v", err)
		}
	})
}

func TestLoginURLAllowlistAndCookieFilter(t *testing.T) {
	allowed := []string{
		"https://muse.ai/",
		"https://www.muse.ai/login",
		"https://sub.muse.ai/sso",
		"https://auth.meta.com/oauth",
		"https://accountscenter.meta.com/verify",
		"https://www.facebook.com/login.php",
		"https://accounts.google.com/o/oauth2/v2/auth",
		"https://appleid.apple.com/auth/authorize",
		"about:blank",
	}
	for _, u := range allowed {
		if !IsAllowedMuseLoginURL(u) {
			t.Fatalf("应放行合法官方认证地址: %s", u)
		}
	}

	blocked := []string{
		"",
		"http://muse.ai/",
		"https://evil-muse.ai/",
		"https://muse.ai.attacker.com/",
		"https://sub.accounts.google.com/",
		"javascript:alert(1)",
		"file:///C:/Windows/System32/drivers/etc/hosts",
		"https://user:pass@muse.ai/",
	}
	for _, u := range blocked {
		if IsAllowedMuseLoginURL(u) {
			t.Fatalf("必须拦截非白名单或危险协议地址: %s", u)
		}
	}

	now := time.Unix(1760000000, 0)
	hdr, err := BuildMinimalMuseCookieHeader([]RawCookie{
		{Name: "hatch_sess", Value: "sess_ok", Domain: ".muse.ai", IsSession: true},
		{Name: "datr", Value: "d1", Domain: "muse.ai", ExpiresAt: float64(now.Add(time.Hour).Unix())},
		{Name: "expired_ck", Value: "old", Domain: ".muse.ai", ExpiresAt: float64(now.Add(-time.Minute).Unix())},
		{Name: "fb_secret", Value: "ignore_me", Domain: ".facebook.com", IsSession: true},
	}, now)
	if err != nil || hdr != "hatch_sess=sess_ok; datr=d1" {
		t.Fatalf("最小 Cookie 过滤结果不符: hdr=%q err=%v", hdr, err)
	}
}
