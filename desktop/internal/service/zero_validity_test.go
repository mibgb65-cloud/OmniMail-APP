package service

import (
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
)

type zeroValiditySession struct {
	fakeSession
	message   domain.RemoteMessage
	afterBody func()
	bodyCalls int
}

func (*zeroValiditySession) Select(string) (uint32, uint32, error) { return 0, 2, nil }
func (*zeroValiditySession) ZeroUIDValidity() bool                 { return true }
func (s *zeroValiditySession) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	if s.message.UID < start || s.message.UID > end {
		return nil, nil
	}
	return []domain.RemoteMessage{s.message}, nil
}
func (s *zeroValiditySession) Body(uint32, domain.AttachmentSink) (domain.DecodedMail, error) {
	s.bodyCalls++
	if s.afterBody != nil {
		s.afterBody()
	}
	return domain.DecodedMail{Text: "new body"}, nil
}

func zeroMailbox(t *testing.T) (*Mail, *repository.Store, string, domain.MailboxCursor) {
	t.Helper()
	mail, store, _, _ := testService(t)
	input := addInput()
	input.ProviderCode, input.IMAP.Host = "naver", "imap.naver.com"
	account, err := mail.AddAccount(t.Context(), input)
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 0)
	if err != nil {
		t.Fatal(err)
	}
	return mail, store, account.ID, cursor
}

func TestSyncExplicitZeroValidityPersistsBody(t *testing.T) {
	mail, store, accountID, _ := zeroMailbox(t)
	session := &zeroValiditySession{message: domain.RemoteMessage{UID: 1, MessageID: "one@example.invalid", Subject: "one", Size: 20}}
	_, err := mail.syncMailbox(t.Context(), accountID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, session)
	if err != nil {
		t.Fatal("协议层已明确确认的零值仍不能同步")
	}
	rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 1 || !rows[0].Cached || session.bodyCalls != 1 {
		t.Fatal("零值邮箱未完成摘要和正文闭环")
	}
}

func TestZeroBodyChecksIdentityBeforeAndAfterFetch(t *testing.T) {
	for _, changedAt := range []string{"before", "after"} {
		t.Run(changedAt, func(t *testing.T) {
			mail, store, accountID, cursor := zeroMailbox(t)
			message := domain.RemoteMessage{UID: 1, MessageID: "old@example.invalid", Subject: "old", Size: 20}
			if err := store.SaveMailBatch(t.Context(), accountID, cursor.ID, 0, 1, 1, []domain.RemoteMessage{message}, nil); err != nil {
				t.Fatal(err)
			}
			rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
			if err != nil || len(rows) != 1 {
				t.Fatal("缺少零值摘要")
			}
			id := rows[0].ID
			location, _, err := store.MailLocation(t.Context(), id)
			if err != nil {
				t.Fatal(err)
			}
			session := &zeroValiditySession{message: message}
			change := func() { session.message.MessageID = "reused@example.invalid" }
			if changedAt == "before" {
				change()
			} else {
				session.afterBody = change
			}
			if _, err := mail.cacheMessage(t.Context(), id, location, session); !errors.Is(err, domain.ErrProtocol) {
				t.Fatal("零值 UID 重用没有阻止正文错配")
			}
			detail, err := store.ReadMail(t.Context(), id)
			if err != nil || detail.Cached {
				t.Fatal("身份变化仍写入了旧实例正文")
			}
			if changedAt == "before" && session.bodyCalls != 0 {
				t.Fatal("身份核对前读取了错误邮件正文")
			}
		})
	}
}

func TestZeroValidityRemoteWritesAreUnsupported(t *testing.T) {
	mail, store, accountID, cursor := zeroMailbox(t)
	if err := store.SaveMailBatch(t.Context(), accountID, cursor.ID, 0, 1, 1,
		[]domain.RemoteMessage{{UID: 1}}, nil); err != nil {
		t.Fatal(err)
	}
	rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 1 {
		t.Fatal("缺少零值测试邮件")
	}
	id := rows[0].ID
	for _, operation := range []func() error{
		func() error { return mail.SetStarred(t.Context(), id, true) },
		func() error { return mail.SetRead(t.Context(), id, true) },
		func() error { return mail.MoveMessage(t.Context(), id, "deleted") },
	} {
		if !errors.Is(operation(), domain.ErrActionUnsupported) {
			t.Fatal("无可靠纪元的邮箱未明确拒绝远端写操作")
		}
	}
}

func TestZeroBodyBacklogReplacesReusedUIDBeforeDownloading(t *testing.T) {
	mail, store, accountID, cursor := zeroMailbox(t)
	old := domain.RemoteMessage{UID: 1, MessageID: "old@example.invalid", Subject: "old", Size: 20}
	if err := store.SaveMailBatch(t.Context(), accountID, cursor.ID, 0, 1, 1, []domain.RemoteMessage{old}, nil); err != nil {
		t.Fatal(err)
	}
	rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 1 {
		t.Fatal("缺少待补摘要")
	}
	oldID := rows[0].ID
	session := &zeroValiditySession{message: old}
	session.message.MessageID = "new@example.invalid"
	pending, _, err := mail.syncStoredBodies(t.Context(), accountID, cursor.ID, 0, session)
	if err != nil || !pending || session.bodyCalls != 0 {
		t.Fatal("旧待办 UID 已重用时仍下载或丢失续排")
	}
	rows, err = store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 1 || rows[0].ID == oldID || rows[0].Cached {
		t.Fatal("新实例错误继承旧待办 ID 或正文")
	}
	pending, _, err = mail.syncStoredBodies(t.Context(), accountID, cursor.ID, 0, session)
	if err != nil || pending || session.bodyCalls != 1 {
		t.Fatal("新实例未能在下一轮补齐")
	}
}
