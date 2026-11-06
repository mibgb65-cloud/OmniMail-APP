package repository

import (
	"context"
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestMailCountsIncludeAllFoldersAndIsolateAccounts(t *testing.T) {
	store := openTestStore(t)
	account, cursor := seedMailbox(t, store)
	other, _ := seedMailbox(t, store)
	counts, err := store.MailCounts(t.Context())
	if err != nil || counts[account.ID] != 2 || counts[other.ID] != 2 {
		t.Fatalf("初始账号计数错误：%v / %v", counts, err)
	}
	archive, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "Archive", Kind: "archive"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	messages := make([]domain.RemoteMessage, 100)
	for index := range messages {
		messages[index] = domain.RemoteMessage{UID: uint32(index + 1), MessageID: "same"}
	}
	if err := store.SaveMailBatch(t.Context(), account.ID, archive.ID, 1, 1, 100, messages, nil); err != nil {
		t.Fatal(err)
	}
	// 重复同步不能膨胀计数；相同 Message-ID 的不同文件夹实例仍是独立本地记录。
	if err := store.SaveMailBatch(t.Context(), account.ID, cursor.ID, 7, 1, 2,
		[]domain.RemoteMessage{{UID: 1}, {UID: 2}}, nil); err != nil {
		t.Fatal(err)
	}
	counts, err = store.MailCounts(t.Context())
	if err != nil || counts[account.ID] != 102 || counts[other.ID] != 2 {
		t.Fatalf("跨文件夹/重复同步计数错误：%v / %v", counts, err)
	}
	if _, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 8); err != nil {
		t.Fatal(err)
	}
	counts, err = store.MailCounts(t.Context())
	if err != nil || counts[account.ID] != 100 {
		t.Fatalf("UIDVALIDITY 重置后计数过期：%v / %v", counts, err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := store.MailCounts(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("未传播取消：%v", err)
	}
}
