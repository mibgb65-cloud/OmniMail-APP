package repository

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"

	"omnimail/desktop/internal/domain"
)

type zeroStream struct{}

func (zeroStream) Read(data []byte) (int, error) { clear(data); return len(data), nil }

func TestFiftyMiBAttachmentStreamsAndRejectsOverflowWithoutLeakingTemporaryFiles(t *testing.T) {
	store := openTestStore(t)
	account, _ := seedMailbox(t, store)
	rows, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	attachment, err := store.CacheAttachment(t.Context(), "large.bin", "application/octet-stream", io.LimitReader(zeroStream{}, domain.MaxAttachmentBytes))
	if err != nil || attachment.Size != domain.MaxAttachmentBytes || len(attachment.Data) != 0 {
		t.Fatalf("50 MiB 流式附件未完整缓存：%v", err)
	}
	if err := store.SaveMailBody(t.Context(), rows[0].ID, domain.DecodedMail{Text: "body", Attachments: []domain.DecodedAttachment{attachment}}); err != nil {
		t.Fatal(err)
	}
	if err := store.ReleaseCachedAttachments(t.Context(), []string{attachment.Hash}); err != nil {
		t.Fatal(err)
	}
	detail, err := store.ReadMail(t.Context(), rows[0].ID)
	if err != nil || len(detail.Attachments) != 1 {
		t.Fatal("附件引用丢失")
	}
	data, _, err := store.ReadAttachment(t.Context(), detail.Attachments[0].ID)
	if err != nil || len(data) != domain.MaxAttachmentBytes {
		t.Fatalf("50 MiB 附件读取仍受旧上限限制：%v", err)
	}
	if _, err := store.CacheAttachment(t.Context(), "too-large.bin", "application/octet-stream", io.LimitReader(zeroStream{}, domain.MaxAttachmentBytes+1)); !errors.Is(err, domain.ErrAttachmentTooLarge) {
		t.Fatalf("未拒绝超限附件：%v", err)
	}
	files, err := filepath.Glob(filepath.Join(store.dataDir, "attachments", ".incoming-*"))
	if err != nil || len(files) != 0 {
		t.Fatal("失败留下半成品")
	}
	path, err := store.contentPath(attachment.Hash)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal("清理错误删除已引用共享内容")
	}
}

func TestBodyLimitMarkersKeepCacheAndExcludeAutomaticBacklog(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(t.Context(), dir)
	if err != nil {
		t.Fatal(err)
	}
	account, cursor := seedMailbox(t, store)
	rows, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	cached, missing := rows[0].ID, rows[1].ID
	if err := store.SaveMailBody(t.Context(), cached, domain.DecodedMail{Text: "old cache"}); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{cached, missing} {
		if err := store.MarkMailBodyLimit(t.Context(), id, domain.ErrMessageTextTooLarge.Error()); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.MarkMailBodyLimit(t.Context(), missing, "PRIVATE_SERVER_ERROR"); !errors.Is(err, domain.ErrProtocol) {
		t.Fatal("接受了未校验的动态原因")
	}
	pending, err := store.PendingMailBodies(t.Context(), account.ID, cursor.ID, 7, 10)
	if err != nil || len(pending) != 0 {
		t.Fatal("固定超限仍会自动反复下载")
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	store, err = Open(t.Context(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := store.Close(); err != nil {
			t.Error(err)
		}
	}()
	detail, err := store.ReadMail(t.Context(), cached)
	if err != nil || !detail.Cached || detail.Body != "old cache" || detail.BodyErrorCode == "" {
		t.Fatal("重开丢失旧正文或失败标记")
	}
	counts, err := store.MailLimitCounts(t.Context())
	if err != nil || counts[account.ID] != 2 {
		t.Fatal("重开后受限数量错误")
	}
	if err := store.SaveMailBody(t.Context(), missing, domain.DecodedMail{Text: "recovered"}); err != nil {
		t.Fatal(err)
	}
	counts, err = store.MailLimitCounts(t.Context())
	if err != nil || counts[account.ID] != 1 {
		t.Fatal("成功重取未清除对应标记")
	}
	// 服务端摘要大小发生改变时，保留旧缓存但重新加入正文待办，不继续沿用过期的固定失败。
	if err := store.SaveMailBatch(t.Context(), account.ID, cursor.ID, 7, 1, 2,
		[]domain.RemoteMessage{{UID: 1, Size: 1}, {UID: 2, Size: 1}}, nil); err != nil {
		t.Fatal(err)
	}
	detail, err = store.ReadMail(t.Context(), cached)
	if err != nil || !detail.Cached || detail.Body != "old cache" || detail.BodyErrorCode != "" || detail.BodyVersion != 0 {
		t.Fatal("服务端变更后没有安全保留缓存并解除旧失败")
	}
	pending, err = store.PendingMailBodies(t.Context(), account.ID, cursor.ID, 7, 10)
	if err != nil || len(pending) != 2 {
		t.Fatal("服务端变更后无法重新补齐正文")
	}
}
