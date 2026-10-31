package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

type countedHeaders struct {
	fakeSession
	calls int
}

type networkFailureHeaders struct{ fakeSession }

func (networkFailureHeaders) Headers(uint32, uint32) ([]domain.RemoteMessage, error) {
	return nil, domain.ErrNetwork
}

func TestSyncYieldDoesNotHideCancellationOrNetworkFailure(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, _, err := mail.syncPass(ctx, account.ID, cursor.ID, 7, 1, 500, 50, false, fakeSession{}); !errors.Is(err, context.Canceled) {
		t.Fatal("软让出把真实取消掩盖为成功")
	}
	ctx, cancel = context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if _, _, err := mail.syncPass(ctx, account.ID, cursor.ID, 7, 1, 500, 50, false, networkFailureHeaders{}); !errors.Is(err, domain.ErrNetwork) {
		t.Fatal("软让出把网络失败掩盖为成功")
	}
	messages, err := mail.Messages(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(messages) != 1 {
		t.Fatal("失败或让出清除了已有缓存")
	}
}

func (s *countedHeaders) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	s.calls++
	return s.fakeSession.Headers(start, end)
}

func TestSyncYieldsBeforeStartingBatchNearDeadline(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	session := new(countedHeaders)
	finished, batches, err := mail.syncPass(ctx, account.ID, cursor.ID, 7, 1, 500, 50, false, session)
	if err != nil || finished || batches != 0 || session.calls != 0 {
		t.Fatalf("临近硬期限仍启动了新批次：finished=%v batches=%d calls=%d code=%s",
			finished, batches, session.calls, ErrorCode(err))
	}
}

type cycleTransport struct {
	fakeTransport
	inboxSelections atomic.Int32
}

func (t *cycleTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	return &cycleSession{owner: t}, nil
}

type cycleSession struct {
	fakeSession
	owner *cycleTransport
	box   string
}

func (s *cycleSession) Mailboxes() ([]domain.RemoteMailbox, error) {
	return []domain.RemoteMailbox{{Name: "INBOX", Kind: "inbox"}, {Name: "Archive", Kind: "archive"}}, nil
}

func (s *cycleSession) Select(name string) (uint32, uint32, error) {
	s.box = name
	if name == "INBOX" {
		s.owner.inboxSelections.Add(1)
		return 7, 2, nil
	}
	return 7, 10001, nil
}

func (s *cycleSession) LocateUID(from uint32) (uint32, bool, error) {
	if s.box == "INBOX" {
		return 1, from <= 1, nil
	}
	return from, from <= 10000, nil
}

func (s *cycleSession) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	return []domain.RemoteMessage{{UID: start, Subject: "cycle fixture", ReceivedAt: 1}}, nil
}

func TestSyncContinuationDoesNotRestartCompletedMailboxes(t *testing.T) {
	mail, _, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	transport := new(cycleTransport)
	mail.transport = transport
	finished := false
	// 完整同步现在包含正文补齐，不把原来只有邮件头的固定轮数当作完成条件。
	for round := 0; round < 12; round++ {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		more, err := mail.syncAccount(ctx, account.ID)
		cancel()
		if err != nil {
			t.Fatalf("第 %d 轮未按游标续传：more=%v code=%s", round+1, more, ErrorCode(err))
		}
		if !more {
			finished = true
			break
		}
	}
	if !finished {
		t.Fatal("邮件头和正文续传未在有限轮数内完成")
	}
	if count := transport.inboxSelections.Load(); count != 1 {
		t.Fatalf("已完成的 inbox 被重复核对 %d 次，后续文件夹可能饥饿", count)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if _, err := mail.syncAccount(ctx, account.ID); err != nil {
		t.Fatal(err)
	}
	if transport.inboxSelections.Load() != 2 {
		t.Fatal("完整周期结束后没有恢复正常核对")
	}
}

type connectionCounter struct {
	fakeTransport
	calls atomic.Int32
}

func (t *connectionCounter) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	t.calls.Add(1)
	return fakeSession{}, nil
}

func TestOldContinuationDoesNotRestartAlreadyCompletedSync(t *testing.T) {
	mail, _, _, _ := testService(t)
	transport := new(connectionCounter)
	mail.transport = transport
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	before := transport.calls.Load()
	mail.continueSync(account.ID)
	// 模拟前台手动同步已完成，旧续排定时器仍在等待。
	mail.mu.Lock()
	state := mail.states[account.ID]
	state.More = false
	mail.states[account.ID] = state
	mail.mu.Unlock()
	mail.wg.Wait()
	if transport.calls.Load() != before {
		t.Fatal("旧定时器在完整同步后又启动了新周期")
	}
}

func TestSyncResumeWaitsForForegroundButDoesNotRetryRealFailure(t *testing.T) {
	for _, failed := range []bool{false, true} {
		t.Run(fmt.Sprint(failed), func(t *testing.T) {
			mail, _, _, _ := testService(t)
			account, err := mail.AddAccount(t.Context(), addInput())
			if err != nil {
				t.Fatal(err)
			}
			awaitSync(t, mail, account.ID)
			mail.mu.Lock()
			state := mail.states[account.ID]
			state.More = true
			if failed {
				state.ErrorCode = "NETWORK_FAILED"
			}
			mail.states[account.ID] = state
			mail.pending[account.ID] = true
			mail.mu.Unlock()
			release, err := mail.claim(account.ID)
			if err != nil {
				t.Fatal(err)
			}
			defer release()
			mail.resumeSync(account.ID)
			mail.mu.Lock()
			pending := mail.pending[account.ID]
			mail.mu.Unlock()
			if pending == failed {
				t.Fatal("前台占用丢失续排，或真实失败被自动循环重试")
			}
		})
	}
}

type completedDuringRead struct {
	domain.MailRepository
	mail *Mail
	once sync.Once
}

func (r *completedDuringRead) GetAccount(ctx context.Context, id string) (domain.Account, error) {
	account, err := r.MailRepository.GetAccount(ctx, id)
	r.once.Do(func() {
		r.mail.mu.Lock()
		state := r.mail.states[id]
		state.More = false
		r.mail.states[id] = state
		r.mail.mu.Unlock()
	})
	return account, err
}

type waitingConnection struct{ fakeTransport }

func (waitingConnection) Connect(ctx context.Context, _ domain.AccountEndpoint, _ []byte) (domain.MailSession, error) {
	<-ctx.Done()
	return nil, ctx.Err()
}

func TestContinuationRechecksCompletionAtomicallyAfterAccountRead(t *testing.T) {
	mail, _, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	mail.store = &completedDuringRead{MailRepository: mail.store, mail: mail}
	mail.transport = &waitingConnection{}
	mail.mu.Lock()
	state := mail.states[account.ID]
	state.More = true
	mail.states[account.ID] = state
	mail.mu.Unlock()
	mail.resumeSync(account.ID)
	mail.mu.Lock()
	active := mail.active[account.ID]
	mail.mu.Unlock()
	if active {
		t.Fatal("账号读取期间完成的周期被旧续排重新启动")
	}
}
