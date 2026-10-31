package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

type moveDuringFetch struct {
	fakeSession
	calls int
	move  func() error
}

func (s *moveDuringFetch) Headers(uint32, uint32) ([]domain.RemoteMessage, error) {
	s.calls++
	if s.calls == 1 {
		if err := s.move(); err != nil {
			return nil, err
		}
		return []domain.RemoteMessage{{UID: 1, Subject: "旧响应", ReceivedAt: 1}}, nil
	}
	return nil, nil
}

func TestMoveInvalidatesOldFetchWithoutLosingCachedBody(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	rows, _ := mail.Messages(t.Context(), account.ID, "inbox", 0)
	id := rows[0].ID
	if err := store.SaveMailBody(t.Context(), id, domain.DecodedMail{Text: "不得丢失的缓存正文"}); err != nil {
		t.Fatal(err)
	}
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	mail.transport = &flagTransport{}
	session := &moveDuringFetch{move: func() error { return mail.MoveMessage(t.Context(), id, "archive") }}
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	done, _, err := mail.syncPass(ctx, account.ID, cursor.ID, 7, 1, 1, 5, false, session)
	if err != nil || !done {
		t.Fatal("同步失败", err)
	}
	detail, err := store.ReadMail(t.Context(), id)
	if err != nil || detail.Mailbox != "Archive" || detail.Body != "不得丢失的缓存正文" || session.calls != 2 {
		t.Fatal("旧 FETCH 覆盖了移动或丢失正文", err)
	}
}

type failedMoveSave struct{ domain.MailRepository }

func (s failedMoveSave) MoveMail(context.Context, string, domain.RemoteMailbox, uint32, uint32) error {
	return errors.New("private-storage-detail")
}

type specialFolderTransport struct {
	flagTransport
	boxes []domain.RemoteMailbox
}
type specialFolderSession struct {
	flagSession
	boxes []domain.RemoteMailbox
}

func (s specialFolderSession) Mailboxes() ([]domain.RemoteMailbox, error) { return s.boxes, nil }
func (s *specialFolderTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	return &specialFolderSession{flagSession: flagSession{transport: &s.flagTransport}, boxes: s.boxes}, nil
}

func TestMoveRejectsMissingAmbiguousAndSameFolder(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	rows, _ := mail.Messages(t.Context(), account.ID, "inbox", 0)
	id := rows[0].ID
	for _, boxes := range [][]domain.RemoteMailbox{
		nil,
		{{Name: "Trash", Kind: "deleted"}, {Name: "OtherTrash", Kind: "deleted"}},
		{{Name: "INBOX", Kind: "deleted"}},
	} {
		mail.transport = &specialFolderTransport{boxes: boxes}
		if err := mail.MoveMessage(t.Context(), id, "deleted"); !errors.Is(err, domain.ErrActionUnsupported) {
			t.Fatal("缺失/歧义/原地目标仍允许移动", err)
		}
		location, _, err := store.MailLocation(t.Context(), id)
		if err != nil || location.Mailbox != "INBOX" {
			t.Fatal("无可用目标仍改本地位置")
		}
	}
	mail.transport = &fakeTransport{}
	if err := mail.SetRead(t.Context(), id, true); !errors.Is(err, domain.ErrActionUnsupported) {
		t.Fatal("只读适配器伪造可写", err)
	}
}

// 复用星标夹具连接与错误控制，覆盖新增写能力而不访问真实邮箱。
func (s *flagSession) SetRead(mailbox string, validity, uid uint32, read bool) error {
	return s.SetStarred(mailbox, validity, uid, read)
}
func (s *flagSession) Mailboxes() ([]domain.RemoteMailbox, error) {
	return []domain.RemoteMailbox{{Name: "INBOX", Kind: "inbox"}, {Name: "Archive", Kind: "archive"}, {Name: "Trash", Kind: "deleted"}}, nil
}
func (s *flagSession) MoveMail(mailbox string, validity, uid uint32, destination string) (uint32, uint32, error) {
	if s.transport.failure != nil {
		return 0, 0, s.transport.failure
	}
	if mailbox != "INBOX" || validity != 7 || uid != 1 || (destination != "Archive" && destination != "Trash") {
		return 0, 0, domain.ErrProtocol
	}
	return 8, 3, nil
}

func TestMailActionsCommitOnlyAfterRemoteSuccess(t *testing.T) {
	mail, store, _, _ := testService(t)
	transport := &flagTransport{}
	mail.transport = transport
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	list, err := mail.Messages(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 1 {
		t.Fatal("缺少测试邮件")
	}
	id := list[0].ID
	if err := mail.SetRead(t.Context(), id, true); err != nil {
		t.Fatal(err)
	}
	detail, _ := store.ReadMail(t.Context(), id)
	if !detail.Read {
		t.Fatal("未保存已读")
	}
	transport.failure = domain.ErrNetwork
	if err := mail.SetRead(t.Context(), id, false); !errors.Is(err, domain.ErrNetwork) {
		t.Fatal(err)
	}
	if err := mail.MoveMessage(t.Context(), id, "deleted"); !errors.Is(err, domain.ErrNetwork) {
		t.Fatal(err)
	}
	mail.store = failedMoveSave{store}
	transport.failure = nil
	if err := mail.MoveMessage(t.Context(), id, "archive"); !errors.Is(err, domain.ErrActionUncertain) {
		t.Fatal("远端成功但本地失败未提示结果待核对", err)
	}
	mail.store = store
	detail, _ = store.ReadMail(t.Context(), id)
	if !detail.Read || detail.Mailbox != "INBOX" {
		t.Fatal("失败改动了本地状态")
	}
	transport.failure = nil
	if err := mail.MoveMessage(t.Context(), id, "deleted"); err != nil {
		t.Fatal(err)
	}
	location, _, _ := store.MailLocation(t.Context(), id)
	if location.Mailbox != "Trash" || location.UIDValidity != 8 || location.UID != 3 {
		t.Fatal("移动未保存新 UID")
	}
	if err := mail.MoveMessage(t.Context(), id, "deleted"); !errors.Is(err, domain.ErrActionUnsupported) {
		t.Fatal("允许重复移入垃圾箱")
	}
	if err := mail.MoveMessage(t.Context(), id, "../bad"); err == nil {
		t.Fatal("接受非法目标")
	}
	if err := mail.SetRead(t.Context(), "../bad", true); err == nil {
		t.Fatal("接受非法 ID")
	}
	if err := mail.Disconnect(t.Context(), account.ID); err != nil {
		t.Fatal(err)
	}
	if err := mail.SetRead(t.Context(), id, true); !errors.Is(err, domain.ErrCredentialMissing) {
		t.Fatal("断连账号允许远端写入", err)
	}
}
