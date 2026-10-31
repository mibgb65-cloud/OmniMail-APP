package repository

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestPendingMailBodiesIncludesHeadersAndLegacyButNotStoredBodies(t *testing.T) {
	store := openTestStore(t)
	account, cursor := seedMailbox(t, store)
	targets, err := store.PendingMailBodies(t.Context(), account.ID, cursor.ID, 7, 1)
	if err != nil || len(targets) != 1 || targets[0].UID != 2 {
		t.Fatal("待补正文应有界且优先最近 UID")
	}
	rows, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(rows) != 2 {
		t.Fatal("缺少合成摘要")
	}
	first := rows[1].ID
	if err := store.SaveMailBody(t.Context(), first, domain.DecodedMail{Text: "", HTML: ""}); err != nil {
		t.Fatal("空正文也应能持久确认")
	}
	if _, err := store.db.ExecContext(t.Context(),
		"UPDATE mail_message SET body_text='legacy synthetic body',body_version=0 WHERE id=?", rows[0].ID); err != nil {
		t.Fatal("无法准备旧版正文")
	}
	targets, err = store.PendingMailBodies(t.Context(), account.ID, cursor.ID, 7, 10)
	if err != nil || len(targets) != 1 || targets[0].ID != rows[0].ID {
		t.Fatal("已保存正文重复入队，或旧版正文未加入补齐")
	}
	if err := store.SaveMailBody(t.Context(), targets[0].ID,
		domain.DecodedMail{Text: "持久文字", HTML: "<p>持久 HTML</p>"}); err != nil {
		t.Fatal("无法保存合成正文")
	}
	targets, err = store.PendingMailBodies(t.Context(), account.ID, cursor.ID, 7, 10)
	if err != nil || len(targets) != 0 {
		t.Fatal("保存成功没有移除待补正文")
	}
}

func TestPendingMailBodiesValidatesBoundariesAndMailboxIdentity(t *testing.T) {
	store := openTestStore(t)
	account, cursor := seedMailbox(t, store)
	other, otherCursor := seedMailbox(t, store)
	for _, limit := range []int{-1, 0, 101} {
		if _, err := store.PendingMailBodies(t.Context(), account.ID, cursor.ID, 7, limit); !errors.Is(err, domain.ErrProtocol) {
			t.Fatal("待补正文查询未限制批量大小")
		}
	}
	if _, err := store.PendingMailBodies(t.Context(), "invalid/id", cursor.ID, 7, 1); !errors.Is(err, domain.ErrProtocol) {
		t.Fatal("待补正文查询未校验账号 ID")
	}
	for _, test := range []struct {
		account, mailbox string
		validity         uint32
	}{
		{account.ID, otherCursor.ID, 7},
		{other.ID, cursor.ID, 7},
		{account.ID, cursor.ID, 8},
	} {
		targets, err := store.PendingMailBodies(t.Context(), test.account, test.mailbox, test.validity, 10)
		if err != nil || len(targets) != 0 {
			t.Fatal("待补正文查询跨账号、文件夹或 UIDVALIDITY 泄漏")
		}
	}
}

func TestBodyBacklogAndDatabaseContentSurviveReopenWithoutBodyFiles(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(t.Context(), dir)
	if err != nil {
		t.Fatal("无法创建合成数据库")
	}
	t.Cleanup(func() {
		if err := store.Close(); err != nil {
			t.Error("无法关闭合成数据库")
		}
	})
	account, cursor := seedMailbox(t, store)
	targets, err := store.PendingMailBodies(t.Context(), account.ID, cursor.ID, 7, 1)
	if err != nil || len(targets) != 1 {
		t.Fatal("合成正文待办缺失")
	}
	body := domain.DecodedMail{Text: "持久离线文字", HTML: "<p>持久离线 HTML</p>"}
	if err := store.SaveMailBody(t.Context(), targets[0].ID, body); err != nil {
		t.Fatal("无法保存合成正文")
	}
	if _, err := os.Stat(filepath.Join(dir, "attachments")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("文字/HTML 正文不应依赖附件或正文缓存文件")
	}
	if err := store.Close(); err != nil {
		t.Fatal("无法关闭已保存正文的数据库")
	}
	reopened, err := Open(t.Context(), dir)
	if err != nil {
		t.Fatal("无法重新打开正文数据库")
	}
	store = reopened
	got, err := store.ReadMail(t.Context(), targets[0].ID)
	if err != nil || got.Body != body.Text || got.RawHTML != body.HTML || got.BodyVersion != 1 {
		t.Fatal("没有正文文件时重开数据库丢失文字或 HTML")
	}
	pending, err := store.PendingMailBodies(t.Context(), account.ID, cursor.ID, 7, 10)
	if err != nil || len(pending) != 1 || pending[0].UID != 1 {
		t.Fatal("正文补齐进度没有从数据库恢复")
	}
}
