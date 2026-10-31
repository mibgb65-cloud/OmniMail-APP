package service

import (
	"context"
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

type limitBodySession struct {
	storedBodySession
	failedUID uint32
	failure   error
	called    []uint32
}

func (s *limitBodySession) Body(uid uint32, sink domain.AttachmentSink) (domain.DecodedMail, error) {
	s.called = append(s.called, uid)
	if uid == s.failedUID {
		return domain.DecodedMail{}, s.failure
	}
	return s.storedBodySession.Body(uid, sink)
}

func TestLargeMailBodyFailureIsPersistedAndDoesNotBlockFollowingMail(t *testing.T) {
	for _, failure := range []error{domain.ErrMessageTextTooLarge, domain.ErrAttachmentTooLarge, domain.ErrTooManyMailParts} {
		t.Run(failure.Error(), func(t *testing.T) {
			mail, store, _, _ := testService(t)
			account, mailbox := seedBodyTargets(t, mail, store, 3, 0)
			session := &limitBodySession{failedUID: 3, failure: failure}
			pending, _, err := mail.syncStoredBodies(t.Context(), account, mailbox, 7, session)
			if err != nil || !pending {
				t.Fatalf("单封超限中断账号：%v / %v", pending, err)
			}
			// 超限断开后的下一连接继续，不能重读 UID 3，也不能丢掉后面的 UID 2。
			for range 2 {
				if _, _, err := mail.syncStoredBodies(t.Context(), account, mailbox, 7, session); err != nil {
					t.Fatal(err)
				}
			}
			var failures int
			for _, uid := range session.called {
				if uid == 3 {
					failures++
				}
			}
			if failures != 1 {
				t.Fatalf("受限邮件反复自动下载：%v", session.called)
			}
			targets, err := store.PendingMailBodies(t.Context(), account, mailbox, 7, 10)
			if err != nil || len(targets) != 0 {
				t.Fatalf("后续正常正文没有完成：%v / %v", targets, err)
			}
			counts, err := store.MailLimitCounts(t.Context())
			if err != nil || counts[account] != 1 {
				t.Fatalf("受限计数丢失：%v / %v", counts, err)
			}
			accounts, err := mail.Accounts(t.Context())
			if err != nil || len(accounts) != 1 || accounts[0].LimitedMessageCount == nil || *accounts[0].LimitedMessageCount != 1 {
				t.Fatal("账号摘要误报完整同步")
			}
		})
	}
}

func TestOversizedRawSummarySkipsWithoutFetchingAndGenericBudgetErrorsRemainFatal(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, mailbox := seedBodyTargets(t, mail, store, 1, domain.MaxRawMessageBytes+1)
	session := new(storedBodySession)
	_, _, err := mail.syncStoredBodies(t.Context(), account, mailbox, 7, session)
	if err != nil || session.calls != 0 {
		t.Fatalf("明显超限邮件仍下载：%v", err)
	}
	counts, err := store.MailLimitCounts(t.Context())
	if err != nil || counts[account] != 1 {
		t.Fatal("未持久标记原始邮件超限")
	}
	// 限额内的大邮件不能因普通批次预算较小而永远无法启动。
	if !new(syncBodyBudget).permits(domain.MaxRawMessageBytes) {
		t.Fatal("100 MiB 邮件永远无法安排")
	}
	session.cause = domain.ErrTooLarge
	if _, err := store.PrepareMailbox(t.Context(), account, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 8); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveMailBatch(t.Context(), account, mailbox, 8, 1, 1, []domain.RemoteMessage{{UID: 1}}, nil); err != nil {
		t.Fatal(err)
	}
	_, _, err = mail.syncStoredBodies(t.Context(), account, mailbox, 8, session)
	if !errors.Is(err, domain.ErrTooLarge) {
		t.Fatal("连接总预算错误被当成单封永久跳过")
	}
	counts, _ = store.MailLimitCounts(context.Background())
	if counts[account] != 0 {
		t.Fatal("通用错误污染单封受限状态")
	}
}

func TestForegroundReadsLimitedSummaryWithoutFetchAndExplicitRefreshRecovers(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, mailbox := seedBodyTargets(t, mail, store, 1, 0)
	pending, err := store.PendingMailBodies(t.Context(), account, mailbox, 7, 1)
	if err != nil || len(pending) != 1 {
		t.Fatal("缺少合成摘要")
	}
	id := pending[0].ID
	if err := store.MarkMailBodyLimit(t.Context(), id, domain.ErrAttachmentTooLarge.Error()); err != nil {
		t.Fatal(err)
	}
	mail.transport = &fakeTransport{authError: domain.ErrAuthentication}
	for range 2 {
		detail, err := mail.Message(t.Context(), id)
		if err != nil || detail.Cached || detail.BodyErrorCode != domain.ErrAttachmentTooLarge.Error() {
			t.Fatalf("查看受限摘要触发无效网络重试或丢失原因：%v", err)
		}
	}
	mail.transport = new(fakeTransport)
	detail, err := mail.RefreshMessage(t.Context(), id)
	if err != nil || !detail.Cached || detail.BodyErrorCode != "" {
		t.Fatalf("显式重取成功仍被永久跳过：%v", err)
	}
	counts, err := store.MailLimitCounts(t.Context())
	if err != nil || counts[account] != 0 {
		t.Fatal("恢复后仍显示未完整数量")
	}
}
