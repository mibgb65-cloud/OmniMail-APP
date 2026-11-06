package service

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

type isolatedCycleSession struct {
	fakeSession
	box      string
	broken   bool
	failures *int
}

func (s *isolatedCycleSession) Select(box string) (uint32, uint32, error) {
	if s.broken {
		return 0, 0, domain.ErrNetwork
	}
	s.box = box
	return 7, 4, nil
}
func (s *isolatedCycleSession) LocateUID(from uint32) (uint32, bool, error) {
	if s.broken {
		return 0, false, domain.ErrNetwork
	}
	return from, from <= 3, nil
}
func (s *isolatedCycleSession) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	if s.broken {
		return nil, domain.ErrNetwork
	}
	var result []domain.RemoteMessage
	for uid := start; uid <= end && uid <= 3; uid++ {
		result = append(result, domain.RemoteMessage{UID: uid, Subject: "synthetic"})
	}
	return result, nil
}
func (s *isolatedCycleSession) Body(uid uint32, _ domain.AttachmentSink) (domain.DecodedMail, error) {
	if s.broken {
		return domain.DecodedMail{}, domain.ErrNetwork
	}
	if s.box == "INBOX" && uid == 3 {
		s.broken = true
		*s.failures++
		return domain.DecodedMail{}, domain.ErrAttachmentTooLarge
	}
	return domain.DecodedMail{Text: "complete body"}, nil
}

func TestLimitedMessageDoesNotBlockOtherFoldersOrReportComplete(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, mailbox := seedBodyTargets(t, mail, store, 2, 0)
	boxes := []domain.RemoteMailbox{{Name: "INBOX", Kind: "inbox"}, {Name: "Archive", Kind: "archive"}}
	failures := 0
	done := false
	for range 10 {
		session := &isolatedCycleSession{failures: &failures}
		more, err := mail.syncMailboxes(t.Context(), account, boxes, session)
		if err != nil {
			t.Fatalf("受限邮件阻塞其他文件夹或复用失效连接：%v", err)
		}
		if !more {
			done = true
			break
		}
	}
	if !done || failures != 1 {
		t.Fatalf("固定超限没有有界收敛：done=%v failures=%d", done, failures)
	}
	inbox, err := store.PendingMailBodies(t.Context(), account, mailbox, 7, 100)
	if err != nil || len(inbox) != 0 {
		t.Fatal("收件箱仍有可处理正文未同步")
	}
	archive, err := store.PageMail(t.Context(), account, "archive", 0)
	if err != nil || len(archive) != 3 {
		t.Fatal("其他文件夹未继续同步")
	}
	for _, message := range archive {
		if !message.Cached {
			t.Fatal("其他文件夹只保存了摘要")
		}
	}
	var output bytes.Buffer
	mail.log = slog.New(slog.NewJSONHandler(&output, nil))
	mail.logSyncCompletion(t.Context(), account, "custom")
	if !strings.Contains(output.String(), "SYNC_LIMITED") || strings.Contains(output.String(), "SYNC_COMPLETE") {
		t.Fatal("受限周期被误报为全量完成")
	}
}

type failedLimitRecord struct{ domain.MailRepository }

func (failedLimitRecord) MarkMailBodyLimit(context.Context, string, string) error {
	return errors.New("PRIVATE_STORAGE_FAILURE")
}

func TestLimitRecordStorageFailureIsNotSilentlySkipped(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, mailbox := seedBodyTargets(t, mail, store, 1, domain.MaxRawMessageBytes+1)
	mail.store = failedLimitRecord{store}
	_, _, err := mail.syncStoredBodies(t.Context(), account, mailbox, 7, new(storedBodySession))
	if ErrorCode(err) != "STORAGE_FAILED" {
		t.Fatalf("受限记录落库失败被吞掉：%v", err)
	}
}

type failedBodyCleanup struct{ domain.MailRepository }

func (failedBodyCleanup) ReleaseCachedAttachments(context.Context, []string) error {
	return errors.New("PRIVATE_CLEANUP_FAILURE")
}

func TestAttachmentCleanupFailureDoesNotBecomePermanentMailLimit(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, mailbox := seedBodyTargets(t, mail, store, 1, 0)
	mail.store = failedBodyCleanup{store}
	session := &limitBodySession{failedUID: 2, failure: domain.ErrAttachmentTooLarge}
	_, _, err := mail.syncStoredBodies(t.Context(), account, mailbox, 7, session)
	if ErrorCode(err) != "STORAGE_FAILED" {
		t.Fatalf("清理失败被当成大小失败永久跳过：%v", err)
	}
	counts, err := store.MailLimitCounts(t.Context())
	if err != nil || counts[account] != 0 {
		t.Fatal("混合失败错误标记了邮件")
	}
}
