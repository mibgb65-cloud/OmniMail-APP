package repository

import (
	"errors"
	"os"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestStreamingAttachmentLeasesAndCommit(t *testing.T) {
	store := openTestStore(t)
	account, _ := seedMailbox(t, store)
	list, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	first, err := store.CacheAttachment(t.Context(), "file.txt", "text/plain", strings.NewReader("streamed"))
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.CacheAttachment(t.Context(), "copy.txt", "text/plain", strings.NewReader("streamed"))
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Data) != 0 || first.Size != 8 || first.Hash != second.Hash {
		t.Fatal("流式下载保留了完整附件或未按内容复用")
	}
	if err := store.ReleaseCachedAttachments(t.Context(), []string{first.Hash}); err != nil {
		t.Fatal(err)
	}
	path, err := store.contentPath(second.Hash)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal("回收删除了另一笔下载的租约")
	}
	if err := store.SaveMailBody(t.Context(), list[0].ID, domain.DecodedMail{Text: "text", Attachments: []domain.DecodedAttachment{second}}); err != nil {
		t.Fatal(err)
	}
	if err := store.ReleaseCachedAttachments(t.Context(), []string{second.Hash}); err != nil {
		t.Fatal(err)
	}
	detail, err := store.ReadMail(t.Context(), list[0].ID)
	if err != nil || len(detail.Attachments) != 1 || detail.Attachments[0].Size != 8 {
		t.Fatal("流式附件未保存")
	}
	data, _, err := store.ReadAttachment(t.Context(), detail.Attachments[0].ID)
	if err != nil || string(data) != "streamed" {
		t.Fatal("已提交租约被删除")
	}
	orphan, err := store.CacheAttachment(t.Context(), "orphan", "text/plain", strings.NewReader("unique"))
	if err != nil {
		t.Fatal(err)
	}
	if err := store.ReleaseCachedAttachments(t.Context(), []string{orphan.Hash}); err != nil {
		t.Fatal(err)
	}
	orphanPath, err := store.contentPath(orphan.Hash)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(orphanPath); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("未提交文件未回收")
	}
}
