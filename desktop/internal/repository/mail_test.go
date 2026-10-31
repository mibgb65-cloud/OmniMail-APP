package repository

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func seedMailbox(t *testing.T, store *Store) (domain.Account, MailboxCursor) {
	t.Helper()
	account := createTestAccount(t, store, accountInput("custom"))
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	messages := []domain.RemoteMessage{{UID: 1, MessageID: "same", Subject: "first", From: "from@example.invalid", ReceivedAt: 1},
		{UID: 2, MessageID: "same", Subject: "second", ReceivedAt: 2}}
	if err := store.SaveMailBatch(t.Context(), account.ID, cursor.ID, 7, 1, 2, messages, nil); err != nil {
		t.Fatal(err)
	}
	return account, cursor
}

func TestMailBatchIdentityIsolationAndRollback(t *testing.T) {
	store := openTestStore(t)
	account, cursor := seedMailbox(t, store)
	other, _ := seedMailbox(t, store)
	list, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 2 {
		t.Fatalf("Message-ID 被误去重：%v / %d", err, len(list))
	}
	if err := store.SaveMailBatch(t.Context(), other.ID, cursor.ID, 7, 3, 3, []domain.RemoteMessage{{UID: 3}}, nil); err == nil {
		t.Fatal("接受跨账号批次")
	}
	if err := store.SaveMailBatch(t.Context(), account.ID, cursor.ID, 7, 3, 4, []domain.RemoteMessage{{UID: 3}, {UID: 4, Subject: strings.Repeat("x", 4097)}}, nil); err == nil {
		t.Fatal("非法批次未回滚")
	}
	list, err = store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 2 {
		t.Fatalf("失败批次留下数据：%v", err)
	}
	changed, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 8)
	if err != nil || changed.LastUID != 0 {
		t.Fatalf("代次变化未重置游标：%v", err)
	}
	list, err = store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 0 {
		t.Fatal("旧代次 UID 未清理")
	}
	list, err = store.PageMail(t.Context(), other.ID, "inbox", 0)
	if err != nil || len(list) != 2 {
		t.Fatal("代次重置误删其他账号")
	}
}

func TestMailBodyAndAttachmentCache(t *testing.T) {
	store := openTestStore(t)
	account, _ := seedMailbox(t, store)
	list, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	body := domain.DecodedMail{Text: "正文", Attachments: []domain.DecodedAttachment{
		{Filename: "../../outside.txt", MIME: "text/plain", Data: []byte("cache-data")}}}
	if err := store.SaveMailBody(t.Context(), list[0].ID, body); err != nil {
		t.Fatal(err)
	}
	detail, err := store.ReadMail(t.Context(), list[0].ID)
	if err != nil || !detail.Cached || detail.Body != "正文" || len(detail.Attachments) != 1 {
		t.Fatalf("正文未保存：%v", err)
	}
	data, name, err := store.ReadAttachment(t.Context(), detail.Attachments[0].ID)
	if err != nil || string(data) != "cache-data" || name != "../../outside.txt" {
		t.Fatalf("附件未往返：%v", err)
	}
	location, _, err := store.MailLocation(t.Context(), list[0].ID)
	if err != nil || location.UIDValidity != 7 || location.UID != 2 {
		t.Fatalf("远端位置不正确：%v", err)
	}
	if err := store.SaveMailBody(t.Context(), "missing", domain.DecodedMail{
		Attachments: []domain.DecodedAttachment{{Filename: "orphan", MIME: "text/plain", Data: []byte("unique orphan")}}}); err == nil {
		t.Fatal("不存在的邮件接受了正文")
	}
	var files int
	err = filepath.WalkDir(filepath.Join(store.dataDir, "attachments"), func(_ string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			files++
		}
		return nil
	})
	if err != nil || files != 1 {
		t.Fatalf("孤立附件未补偿清理：%v / %d", err, files)
	}
}

func TestSuccessfulBatchReconcilesOnlyRequestedRange(t *testing.T) {
	store := openTestStore(t)
	account, cursor := seedMailbox(t, store)
	scan := uint32(1)
	if err := store.SaveMailBatch(t.Context(), account.ID, cursor.ID, 7, 1, 1, nil, &scan); err != nil {
		t.Fatal(err)
	}
	list, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 1 || list[0].Subject != "second" {
		t.Fatal("删除范围不正确")
	}
	cursor, err = store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil || cursor.LastUID != 2 || cursor.ScanUID != 1 {
		t.Fatal("同步和核对游标混用")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := store.SaveMailBatch(ctx, account.ID, cursor.ID, 7, 2, 2, nil, nil); !errors.Is(err, context.Canceled) {
		t.Fatal("取消错误丢失")
	}
	if _, err := store.contentPath("../outside"); err == nil {
		t.Fatal("缓存路径接受外部输入")
	}
	if _, _, err := store.ReadAttachment(t.Context(), "../outside"); err == nil {
		t.Fatal("附件 ID 未校验")
	}
	if _, err := os.Stat(filepath.Join(store.dataDir, "outside.txt")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("原始文件名被用于缓存路径")
	}
}

func TestDisconnectedAccountCanReadRetainedMail(t *testing.T) {
	store := openTestStore(t)
	account, _ := seedMailbox(t, store)
	if _, err := store.DisconnectAccount(t.Context(), account.ID); err != nil {
		t.Fatal(err)
	}
	retained, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(retained) != 2 {
		t.Fatal("已断开账号的本地邮件不可见")
	}
	unified, err := store.PageMail(t.Context(), "", "inbox", 0)
	if err != nil || len(unified) != 0 {
		t.Fatal("已断开账号混入统一收件箱")
	}
}
