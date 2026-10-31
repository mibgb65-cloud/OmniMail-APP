package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

func TestForegroundLanesAreBoundedAndCredentialRevocationStaysExclusive(t *testing.T) {
	mail, _, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	body, err := mail.acquireForeground(t.Context(), account.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	flags, err := mail.acquireForeground(t.Context(), account.ID, true)
	if err != nil {
		body()
		t.Fatal(err)
	}
	if err := mail.Disconnect(t.Context(), account.ID); ErrorCode(err) != "BUSY" {
		body()
		flags()
		t.Fatal("撤销凭据与活跃连接没有互斥")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if release, err := mail.acquireForeground(ctx, account.ID, false); !errors.Is(err, context.Canceled) {
		if release != nil {
			release()
		}
		body()
		flags()
		t.Fatal("同类排队无法取消")
	}
	body()
	flags()
	if err := mail.Disconnect(t.Context(), account.ID); err != nil {
		t.Fatal(err)
	}
}

type blockedBodyTransport struct {
	fakeTransport
	started chan struct{}
	release chan struct{}
}

func (f *blockedBodyTransport) Connect(ctx context.Context, _ domain.AccountEndpoint, _ []byte) (domain.MailSession, error) {
	return &blockedBodySession{ctx: ctx, owner: f}, nil
}

type blockedBodySession struct {
	fakeSession
	ctx   context.Context
	owner *blockedBodyTransport
}

func (s *blockedBodySession) Body(uint32, domain.AttachmentSink) (domain.DecodedMail, error) {
	close(s.owner.started)
	select {
	case <-s.owner.release:
		return domain.DecodedMail{Text: "正文已完成"}, nil
	case <-s.ctx.Done():
		return domain.DecodedMail{}, s.ctx.Err()
	}
}
func (s *blockedBodySession) SetStarred(string, uint32, uint32, bool) error { return nil }

func TestSlowBodyDoesNotBlockStarOrNewSync(t *testing.T) {
	mail, _, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	rows, _ := mail.Messages(t.Context(), account.ID, "inbox", 0)
	transport := &blockedBodyTransport{started: make(chan struct{}), release: make(chan struct{})}
	mail.transport = transport
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	bodyResult := make(chan error, 1)
	go func() { _, err := mail.RefreshMessage(ctx, rows[0].ID); bodyResult <- err }()
	select {
	case <-transport.started:
	case <-ctx.Done():
		t.Fatal("正文未开始")
	}
	if err := mail.SetStarred(ctx, rows[0].ID, true); err != nil {
		t.Fatalf("星标被正文阻塞：%s", ErrorCode(err))
	}
	if err := mail.QueueSync(account.ID); err != nil {
		t.Fatalf("后台同步被正文阻塞：%s", ErrorCode(err))
	}
	close(transport.release)
	if err := <-bodyResult; err != nil {
		t.Fatal(err)
	}
}

type foregroundTransport struct {
	fakeTransport
	connectCount atomic.Int32
}

func (f *foregroundTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	f.connectCount.Add(1)
	return foregroundSession{}, nil
}

type foregroundSession struct{ fakeSession }

func (foregroundSession) SetStarred(string, uint32, uint32, bool) error { return nil }

func TestForegroundDoesNotWaitForSyncClaimOrBackgroundSlots(t *testing.T) {
	mail, _, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	rows, _ := mail.Messages(t.Context(), account.ID, "inbox", 0)
	transport := &foregroundTransport{}
	mail.transport = transport
	mail.mu.Lock()
	mail.active[account.ID] = true
	mail.mu.Unlock()
	defer func() { mail.mu.Lock(); delete(mail.active, account.ID); mail.mu.Unlock() }()
	for range cap(mail.network) {
		mail.network <- struct{}{}
	}
	defer func() {
		for range cap(mail.network) {
			<-mail.network
		}
	}()
	ctx, cancel := context.WithTimeout(t.Context(), time.Second)
	defer cancel()
	if _, err := mail.RefreshMessage(ctx, rows[0].ID); err != nil {
		t.Fatalf("正文被同步锁或后台额度阻塞：%s", ErrorCode(err))
	}
	if err := mail.SetStarred(ctx, rows[0].ID, true); err != nil {
		t.Fatalf("星标被同步锁或后台额度阻塞：%s", ErrorCode(err))
	}
	if transport.connectCount.Load() != 2 {
		t.Fatal("前台未使用独立连接")
	}
}

type staleFlagSession struct {
	fakeSession
	calls  int
	commit func() error
}

func (s *staleFlagSession) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	s.calls++
	if s.calls == 1 {
		if err := s.commit(); err != nil {
			return nil, err
		}
	}
	return []domain.RemoteMessage{{UID: 1, Subject: "fixture", ReceivedAt: 1, Starred: s.calls > 1}}, nil
}
func TestSyncRefetchesFlagsWhenLocalCommitOverlapsFetch(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	rows, _ := mail.Messages(t.Context(), account.ID, "inbox", 0)
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	mail.transport = &foregroundTransport{}
	session := &staleFlagSession{commit: func() error { return mail.SetStarred(t.Context(), rows[0].ID, true) }}
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	done, _, err := mail.syncPass(ctx, account.ID, cursor.ID, 7, 1, 1, 5, false, session)
	if err != nil || !done {
		t.Fatalf("同步失败：%v", err)
	}
	got, _ := store.ReadMail(t.Context(), rows[0].ID)
	if !got.Starred || session.calls != 2 {
		t.Fatal("在途同步的旧标记覆盖了用户星标")
	}
}

type failedFlagSave struct{ domain.MailRepository }

func (s failedFlagSave) UpdateMailStarred(context.Context, string, bool) error {
	return errors.New("fixture storage failure")
}

func TestRemoteConfirmedFlagInvalidatesSnapshotEvenWhenLocalSaveFails(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	rows, _ := mail.Messages(t.Context(), account.ID, "inbox", 0)
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	mail.store = failedFlagSave{store}
	mail.transport = &foregroundTransport{}
	session := &staleFlagSession{commit: func() error {
		if err := mail.SetStarred(t.Context(), rows[0].ID, true); ErrorCode(err) != "STORAGE_FAILED" {
			return errors.New("未保留本地保存失败")
		}
		return nil
	}}
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	done, _, err := mail.syncPass(ctx, account.ID, cursor.ID, 7, 1, 1, 5, false, session)
	if err != nil || !done {
		t.Fatal("同步未能重新获取服务器已确认状态")
	}
	got, _ := store.ReadMail(t.Context(), rows[0].ID)
	if !got.Starred || session.calls != 2 {
		t.Fatal("已确认的远端写入被过期快照覆盖")
	}
}
