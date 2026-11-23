package outbox

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

func openTestOutboxSession(t *testing.T) *profilemgr.Session {
	t.Helper()
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatalf("open mail db: %v", err)
	}
	t.Cleanup(func() { _ = storage.CheckpointAndClose(db) })

	vault, err := security.OpenVault("prof-test", dir)
	if err != nil {
		t.Fatalf("open vault: %v", err)
	}
	blobs := storage.NewBlobStore(dir)
	settings := config.DefaultAppSettings()
	settings.UndoSendSeconds = 10
	settings.LockReplyToOriginalAccount = true
	_ = config.SaveProfileSettings(dir, settings)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	_, err = accounts.Create(db, vault, accounts.ConnectRequest{
		Provider: "netease", Name: "Work Mail", Email: "work@company.com",
		AuthMode: "password", Secret: "pass1", SkipProbe: true,
	})
	if err != nil {
		t.Fatalf("insert acc1: %v", err)
	}
	_, err = accounts.Create(db, vault, accounts.ConnectRequest{
		Provider: "gmail", Name: "Personal Mail", Email: "personal@gmail.com",
		AuthMode: "password", Secret: "abcd efgh ijkl mnop", SkipProbe: true,
	})
	if err != nil {
		t.Fatalf("insert acc2: %v", err)
	}

	return &profilemgr.Session{
		Meta:       config.ProfileMeta{ID: "prof-test", Name: "Test"},
		ProfileDir: dir,
		DB:         db,
		Vault:      vault,
		Blobs:      blobs,
		Ctx:        ctx,
		Cancel:     cancel,
	}
}

func TestMIMEBuilderBCCPrivacyAndAttachment(t *testing.T) {
	attFile := filepath.Join(t.TempDir(), "report.txt")
	_ = os.WriteFile(attFile, []byte("hello attachment"), 0o600)

	built, err := mailproto.BuildRFC5322(mailproto.BuildMessageInput{
		FromName:  "Alice",
		FromEmail: "alice@example.com",
		To:        []string{"Bob <bob@example.com>"},
		Cc:        []string{"carol@example.com"},
		Bcc:       []string{"secret-vip@example.com"},
		Subject:   "季度总结汇报",
		BodyText:  "请查收附件。",
		Attachments: []mailproto.OutgoingAttachment{
			{Filename: "report.txt", FilePath: attFile},
		},
	})
	if err != nil {
		t.Fatalf("BuildRFC5322 failed: %v", err)
	}
	if bytes.Contains(bytes.ToLower(built.RawBytes), []byte("secret-vip@example.com")) {
		t.Fatalf("SECURITY VIOLATION: BCC address leaked into RFC5322 headers/body")
	}
	if bytes.Contains(bytes.ToLower(built.RawBytes), []byte("\nbcc:")) {
		t.Fatalf("SECURITY VIOLATION: Bcc header present in RFC5322 output")
	}
	foundBcc := false
	for _, r := range built.EnvelopeRecipients {
		if r == "secret-vip@example.com" {
			foundBcc = true
		}
	}
	if !foundBcc {
		t.Fatalf("expected BCC in SMTP envelope recipients, got %v", built.EnvelopeRecipients)
	}
}

func TestIdentityLockAndUndoSendRace(t *testing.T) {
	sess := openTestOutboxSession(t)
	accs, _ := accounts.List(sess.DB, sess.Vault)
	workAcc, personalAcc := accs[0], accs[1]

	nowMs := time.Now().UnixMilli()
	_, _ = sess.DB.Exec(`INSERT INTO threads(id, account_id, subject, snippet, last_msg_at) VALUES ('t1', ?, 'Contract', 'Hi', ?)`, workAcc.ID, nowMs)
	_, _ = sess.DB.Exec(`
		INSERT INTO messages(id, account_id, thread_id, rfc_message_id, folder, sender_name, sender_email, to_json, cc_json, subject, snippet, body_text, sent_at, received_at)
		VALUES ('m-orig', ?, 't1', 'orig.123@client.com', 'inbox', 'Client', 'client@corp.com', '[{"email":"work@company.com"}]', '[]', 'Contract', 'Hi', 'Please confirm', ?, ?)
	`, workAcc.ID, nowMs, nowMs)

	settings := config.LoadProfileSettings(sess.ProfileDir)
	draft, err := CreateDraft(sess.DB, settings, CreateDraftRequest{
		Mode:          "reply",
		ReplyToMailID: "m-orig",
	})
	if err != nil {
		t.Fatalf("CreateDraft reply: %v", err)
	}
	if draft.AccountID != workAcc.ID || !draft.LockedAccount {
		t.Fatalf("expected locked work account, got account=%s locked=%v", draft.AccountID, draft.LockedAccount)
	}

	// 未确认解锁强行切个人邮箱保存或发送必须被 ERR_IDENTITY_LOCKED 拦截
	tampered := draft
	tampered.AccountID = personalAcc.ID
	if _, err := SaveDraft(sess.DB, tampered); !strings.Contains(apperr.CodeOf(err), apperr.CodeIdentityLocked) {
		t.Fatalf("expected ERR_IDENTITY_LOCKED on SaveDraft, got %v", err)
	}

	var smtpCalls int32
	sched := NewScheduler(oauth.NewTokenManager(), events.NewBus())
	sched.SetTransportOverride(func(_ context.Context, _ mailproto.EndpointConfig, _ string, _ []string, _ []byte) error {
		atomic.AddInt32(&smtpCalls, 1)
		return nil
	})

	if _, err := sched.SendDraft(sess, SendDraftRequest{DraftID: draft.ID, Draft: &tampered}); !strings.Contains(apperr.CodeOf(err), apperr.CodeIdentityLocked) {
		t.Fatalf("expected ERR_IDENTITY_LOCKED on SendDraft, got %v", err)
	}

	// 正常发送进入 10s 撤销窗口，此时零网络请求，调用 UndoSend 完美撤回
	draft.Body = "确认收到，谢谢！"
	job, err := sched.SendDraft(sess, SendDraftRequest{DraftID: draft.ID, Draft: &draft})
	if err != nil {
		t.Fatalf("SendDraft valid: %v", err)
	}
	if job.State != "undo_pending" || atomic.LoadInt32(&smtpCalls) != 0 {
		t.Fatalf("expected undo_pending with 0 SMTP calls, got state=%s calls=%d", job.State, smtpCalls)
	}
	restored, err := sched.UndoSend(sess, job.ID)
	if err != nil || restored.ID != draft.ID {
		t.Fatalf("UndoSend failed: %v", err)
	}

	// 跳过撤销窗口立即发送后，再次调用 UndoSend 必须诚实返回 ERR_UNDO_WINDOW_EXPIRED
	job2, err := sched.SendDraft(sess, SendDraftRequest{DraftID: draft.ID, Draft: &draft, BypassUndoWindow: true})
	if err != nil {
		t.Fatalf("SendDraft immediate: %v", err)
	}
	sched.processDueJobs(sess.Ctx, sess)
	if atomic.LoadInt32(&smtpCalls) != 1 {
		t.Fatalf("expected 1 SMTP delivery, got %d", smtpCalls)
	}
	if _, err := sched.UndoSend(sess, job2.ID); !strings.Contains(apperr.CodeOf(err), apperr.CodeUndoWindowExpired) {
		t.Fatalf("expected ERR_UNDO_WINDOW_EXPIRED after delivery, got %v", err)
	}

	// 验证 5xx 永久失败直接置为 failed 而不无限退避重试
	sched.SetTransportOverride(func(_ context.Context, _ mailproto.EndpointConfig, _ string, _ []string, _ []byte) error {
		return errors.New("550 5.1.1 <bad@corp.com>: Recipient address rejected")
	})
	d3, _ := CreateDraft(sess.DB, settings, CreateDraftRequest{Mode: "new", PrefillTo: []string{"bad@corp.com"}, Subject: "Test 550", Body: "Hi"})
	job3, _ := sched.SendDraft(sess, SendDraftRequest{DraftID: d3.ID, BypassUndoWindow: true})
	sched.processDueJobs(sess.Ctx, sess)
	jobs, _ := ListJobs(sess.DB, "outbox")
	if len(jobs) == 0 || jobs[0].ID != job3.ID || jobs[0].State != "failed" {
		t.Fatalf("expected permanent 550 job in failed outbox state, got %+v", jobs)
	}
}
