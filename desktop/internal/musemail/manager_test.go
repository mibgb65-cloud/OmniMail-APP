package musemail

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

type fakeLoginWin struct {
	alive   atomic.Bool
	cookies []RawCookie
}

func newFakeLoginWin(cookies []RawCookie) *fakeLoginWin {
	w := &fakeLoginWin{cookies: cookies}
	w.alive.Store(true)
	return w
}

func (w *fakeLoginWin) IsAlive() bool { return w.alive.Load() }
func (w *fakeLoginWin) ExtractMuseCookies(_ context.Context) ([]RawCookie, error) {
	return w.cookies, nil
}
func (w *fakeLoginWin) Close() error {
	w.alive.Store(false)
	return nil
}

type scriptedGateway struct {
	emailFn  func(ctx context.Context) (string, error)
	listFn   func(ctx context.Context, cursor string) ([]byte, error)
	threadFn func(ctx context.Context, id string) ([]byte, error)
	closed   atomic.Bool
}

func (g *scriptedGateway) GetMailboxEmail(ctx context.Context) (string, error) {
	return g.emailFn(ctx)
}
func (g *scriptedGateway) ListThreadsRaw(ctx context.Context, cursor string) ([]byte, error) {
	return g.listFn(ctx, cursor)
}
func (g *scriptedGateway) GetThreadRaw(ctx context.Context, id string) ([]byte, error) {
	return g.threadFn(ctx, id)
}
func (g *scriptedGateway) Close() error {
	g.closed.Store(true)
	return nil
}

type funcConnector func(ctx context.Context, cookie string) (GatewaySession, error)

func (f funcConnector) Connect(ctx context.Context, cookie string) (GatewaySession, error) {
	return f(ctx, cookie)
}

func makeProfileSession(id string) (*profilemgr.Session, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	return &profilemgr.Session{Meta: config.ProfileMeta{ID: id, Name: id}, Ctx: ctx, Cancel: cancel}, cancel
}

func TestManagerCursorDedupLoopTerminationAndThreadAccessGuard(t *testing.T) {
	win := newFakeLoginWin([]RawCookie{{Name: "hatch_sess", Value: "s1", Domain: ".muse.ai", IsSession: true}})
	gw := &scriptedGateway{
		emailFn: func(_ context.Context) (string, error) { return "user@muse.ai", nil },
		listFn: func(_ context.Context, cursor string) ([]byte, error) {
			if cursor == "" {
				return []byte(`{"data":[{"id":"t1","subject":"First","last_message":{"created_at":0}},{"id":"t2","subject":"Second","last_message":{"created_at":1760000000}}],"paging":{"cursors":{"after":"up_1"}}}`), nil
			}
			return []byte(`{"data":[{"id":"t2","subject":"Dup"},{"id":"t3","subject":"Third"}],"paging":{"cursors":{"after":"up_1"}}}`), nil
		},
		threadFn: func(_ context.Context, _ string) ([]byte, error) {
			return []byte(`{"messages":[{"id":"m1","direction":"inbound","header_from":"peer@example.com","text_body":"Hi","sender_authentication":{"verdict":"pass"}},{"id":"m2","header_from":"user@muse.ai","extracted_text":"Reply","attachments":[{"filename":"spec.pdf","mime_type":"application/pdf","size":1024}]}]}`), nil
		},
	}

	mgr := NewManagerWithDeps(
		func() (LoginWindow, error) { return win, nil },
		funcConnector(func(_ context.Context, _ string) (GatewaySession, error) { return gw, nil }),
	)
	sess, cancel := makeProfileSession("personal")
	defer cancel()
	mgr.OnSessionOpened(sess)

	_, _ = mgr.BeginConnect(sess)
	ver, err := mgr.VerifyConnection(sess)
	if err != nil || ver.Email != "user@muse.ai" {
		t.Fatalf("VerifyConnection 失败: ver=%+v err=%v", ver, err)
	}
	st, err := mgr.ConfirmConnection(sess, "Muse 个人箱")
	if err != nil || !st.Bound || st.AccountName != "Muse 个人箱" {
		t.Fatalf("ConfirmConnection 失败: st=%+v err=%v", st, err)
	}

	page1, err := mgr.ListThreads(sess, "")
	if err != nil || len(page1.Threads) != 2 || !page1.HasMore || page1.Threads[0].TimeKnown || !page1.Threads[1].TimeKnown {
		t.Fatalf("Page1 异常: %+v err=%v", page1, err)
	}
	page2, err := mgr.ListThreads(sess, page1.NextCursor)
	if err != nil || len(page2.Threads) != 1 || page2.Threads[0].ID != "t3" || page2.HasMore || page2.NextCursor != "" {
		t.Fatalf("Page2 去重与循环游标终止错误: %+v err=%v", page2, err)
	}
	if _, err := mgr.GetThread(sess, "unloaded_thread"); apperr.CodeOf(err) != apperr.CodeNotFound {
		t.Fatalf("未加载会话必须拦截读取: %v", err)
	}
	detail, err := mgr.GetThread(sess, "t1")
	if err != nil || len(detail.Messages) != 2 || detail.Messages[0].Direction != "inbound" || detail.Messages[1].Direction != "outbound" || detail.Messages[0].MuseAuthVerdict != "pass" || len(detail.Messages[1].Attachments) != 1 {
		t.Fatalf("GetThread 归一化错误: %+v err=%v", detail, err)
	}
}

func TestManagerIdentityChangeBlocksAndClearsAndWorkspaceSwitchDiscardsLateResponse(t *testing.T) {
	currentEmail := "first@muse.ai"
	slowListGate := make(chan struct{})
	gw := &scriptedGateway{
		emailFn: func(_ context.Context) (string, error) { return currentEmail, nil },
		listFn: func(ctx context.Context, _ string) ([]byte, error) {
			select {
			case <-slowListGate:
				return []byte(`{"data":[{"id":"tx","subject":"Normal"}]}`), nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		},
		threadFn: func(_ context.Context, _ string) ([]byte, error) { return []byte(`{"messages":[]}`), nil },
	}
	mgr := NewManagerWithDeps(
		func() (LoginWindow, error) {
			return newFakeLoginWin([]RawCookie{{Name: "hatch_sess", Value: "s1", Domain: ".muse.ai", IsSession: true}}), nil
		},
		funcConnector(func(_ context.Context, _ string) (GatewaySession, error) { return gw, nil }),
	)

	sessA, cancelA := makeProfileSession("work-a")
	defer cancelA()
	mgr.OnSessionOpened(sessA)
	_, _ = mgr.BeginConnect(sessA)
	_, _ = mgr.VerifyConnection(sessA)
	_, _ = mgr.ConfirmConnection(sessA, "")
	close(slowListGate)
	if _, err := mgr.ListThreads(sessA, ""); err != nil {
		t.Fatalf("初次读取失败: %v", err)
	}

	currentEmail = "switched@muse.ai"
	if _, err := mgr.ListThreads(sessA, ""); apperr.CodeOf(err) != apperr.CodeMuseIdentityChanged {
		t.Fatalf("身份变更必须返回 ERR_MUSE_IDENTITY_CHANGED: %v", err)
	}
	afterMismatch := mgr.GetStatus(sessA)
	if afterMismatch.Bound || afterMismatch.VerifiedEmail != "" || afterMismatch.LastErrorCode != apperr.CodeMuseIdentityChanged {
		t.Fatalf("身份变更后必须立即清空绑定与内存状态: %+v", afterMismatch)
	}

	slowListGate = make(chan struct{})
	gw.closed.Store(false)
	_, _ = mgr.BeginConnect(sessA)
	_, _ = mgr.VerifyConnection(sessA)
	_, _ = mgr.ConfirmConnection(sessA, "")
	errCh := make(chan error, 1)
	go func() {
		_, err := mgr.ListThreads(sessA, "")
		errCh <- err
	}()
	time.Sleep(25 * time.Millisecond)

	sessB, cancelB := makeProfileSession("work-b")
	defer cancelB()
	cancelA()
	mgr.OnSessionClosing(sessA)
	mgr.OnSessionOpened(sessB)

	lateErr := <-errCh
	if apperr.CodeOf(lateErr) != apperr.CodeMuseCancelled && apperr.CodeOf(lateErr) != apperr.CodeMuseGatewayFailed {
		t.Fatalf("切空间后在途请求应立即取消丢弃: %v", lateErr)
	}
	if stB := mgr.GetStatus(sessB); stB.Bound || stB.VerifiedEmail != "" {
		t.Fatalf("新工作空间不得继承旧空间 Muse 会话: %+v", stB)
	}
}
