package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
)

func TestBackgroundSyncPersistsUnopenedBody(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal("无法添加合成账号")
	}
	awaitSync(t, mail, account.ID)
	list, err := mail.Messages(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 1 {
		t.Fatal("未同步合成邮件")
	}
	// 不调用 Message/RefreshMessage：直接读取仓储，证明不是点击后才下载。
	detail, err := store.ReadMail(t.Context(), list[0].ID)
	if err != nil || !detail.Cached || detail.BodyVersion != 1 || detail.Body != "decoded fixture" {
		t.Fatal("后台同步完成时，未打开邮件仍只有摘要、没有数据库正文")
	}
	if detail.Read {
		t.Fatal("后台下载正文不应标记邮件已读")
	}
}

func seedBodyTargets(t *testing.T, mail *Mail, store *repository.Store, count int, size uint32) (string, string) {
	t.Helper()
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal("无法准备正文补齐账号")
	}
	awaitSync(t, mail, account.ID)
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal("无法准备正文补齐文件夹")
	}
	headers := make([]domain.RemoteMessage, count)
	for i := range headers {
		headers[i] = domain.RemoteMessage{UID: uint32(i + 2), Size: size, Subject: "synthetic pending body"}
	}
	if err := store.SaveMailBatch(t.Context(), account.ID, cursor.ID, 7, 2, uint32(count+1), headers, nil); err != nil {
		t.Fatal("无法准备只有摘要的旧记录")
	}
	return account.ID, cursor.ID
}

type storedBodySession struct {
	fakeSession
	calls     int
	cause     error
	cancel    context.CancelFunc
	missing   bool
	badUID    bool
	searchErr error
}

func (s *storedBodySession) LocateUID(from uint32) (uint32, bool, error) {
	if s.searchErr != nil {
		return 0, false, s.searchErr
	}
	if s.badUID {
		return from - 1, true, nil
	}
	if s.missing {
		return 0, false, nil
	}
	return from, true, nil
}

func (s *storedBodySession) Body(uint32, domain.AttachmentSink) (domain.DecodedMail, error) {
	s.calls++
	if s.cancel != nil {
		s.cancel()
	}
	return domain.DecodedMail{Text: "offline persisted text", HTML: "<p>offline persisted HTML</p>"}, s.cause
}

func TestBodyBackfillIsBoundedResumableAndDoesNotRedownload(t *testing.T) {
	mail, store, _, _ := testService(t)
	accountID, mailboxID := seedBodyTargets(t, mail, store, 40, 0)
	session := new(storedBodySession)
	for pass, wantMore := range []bool{true, false, false} {
		pending, _, err := mail.syncStoredBodies(t.Context(), accountID, mailboxID, 7, session)
		if err != nil || pending != wantMore {
			t.Fatalf("第 %d 轮正文补齐未按数据库待办续传：pending=%v code=%s", pass+1, pending, ErrorCode(err))
		}
		if pass == 0 && session.calls != syncBodyBatchLimit {
			t.Fatal("后台正文没有限制单次下载数量")
		}
	}
	if session.calls != 40 {
		t.Fatal("已保存正文重复下载，或旧摘要没有全部补齐")
	}
	rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 41 {
		t.Fatal("正文补齐破坏了已有邮件")
	}
	for _, row := range rows {
		if !row.Cached || row.Read {
			t.Fatal("补齐后缺少本地正文或误标已读")
		}
	}
}

func TestBodyBackfillYieldsForTimeAndConnectionByteBudget(t *testing.T) {
	mail, store, _, _ := testService(t)
	accountID, mailboxID := seedBodyTargets(t, mail, store, 2, 20<<20)
	session := new(storedBodySession)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	pending, downloaded, err := mail.syncStoredBodies(ctx, accountID, mailboxID, 7, session)
	cancel()
	if err != nil || !pending || downloaded || session.calls != 0 {
		t.Fatal("临近期限仍启动正文下载")
	}
	pending, _, err = mail.syncStoredBodies(t.Context(), accountID, mailboxID, 7, session)
	if err != nil || !pending || session.calls != 1 {
		t.Fatal("单连接正文累计预算未保留余量")
	}
	pending, _, err = mail.syncStoredBodies(t.Context(), accountID, mailboxID, 7, session)
	if err != nil || pending || session.calls != 2 {
		t.Fatal("下一连接没有继续保存未完成正文")
	}
}

type failedBodySave struct{ domain.MailRepository }

func (failedBodySave) SaveMailBody(context.Context, string, domain.DecodedMail) error {
	return errors.New("PRIVATE_STORAGE_ERROR")
}

func TestBodyBackfillFailuresKeepDatabaseBacklogAndOldContent(t *testing.T) {
	for _, failure := range []string{"network", "format", "oversize", "storage", "canceled", "search", "uid"} {
		t.Run(failure, func(t *testing.T) {
			mail, store, _, _ := testService(t)
			size := uint32(0)
			if failure == "oversize" {
				size = (40 << 20) + 1
			}
			accountID, mailboxID := seedBodyTargets(t, mail, store, 1, size)
			session := new(storedBodySession)
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			wantCode := "NETWORK_FAILED"
			switch failure {
			case "network":
				session.cause = domain.ErrNetwork
			case "format":
				session.cause, wantCode = domain.ErrProtocol, "MAIL_PROTOCOL_FAILED"
			case "oversize":
				wantCode = "MESSAGE_TOO_LARGE"
			case "storage":
				mail.store, wantCode = failedBodySave{store}, "STORAGE_FAILED"
			case "canceled":
				session.cancel, wantCode = cancel, "CANCELED"
			case "search":
				session.searchErr = domain.ErrNetwork
			case "uid":
				session.badUID, wantCode = true, "MAIL_PROTOCOL_FAILED"
			}
			pending, _, err := mail.syncStoredBodies(ctx, accountID, mailboxID, 7, session)
			if !pending || ErrorCode(err) != wantCode {
				t.Fatal("正文补齐失败被标记完成或丢失错误分类")
			}
			targets, err := store.PendingMailBodies(t.Context(), accountID, mailboxID, 7, 10)
			if err != nil || len(targets) != 1 || targets[0].UID != 2 {
				t.Fatal("失败丢失数据库待办")
			}
			rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
			if err != nil || len(rows) != 2 {
				t.Fatal("正文失败清除了已有邮件")
			}
			for _, row := range rows {
				if row.Cached {
					old, err := store.ReadMail(t.Context(), row.ID)
					if err != nil || old.Body != "decoded fixture" {
						t.Fatal("补齐失败覆盖了已有正文")
					}
				}
			}
			if failure == "oversize" && session.calls != 0 {
				t.Fatal("已知超大邮件仍发起下载")
			}
		})
	}
}

func TestBodyBackfillReconcilesOnlyConfirmedGoneRemoteUIDs(t *testing.T) {
	mail, store, _, _ := testService(t)
	accountID, mailboxID := seedBodyTargets(t, mail, store, 1, 0)
	session := &storedBodySession{missing: true}
	pending, _, err := mail.syncStoredBodies(t.Context(), accountID, mailboxID, 7, session)
	if err != nil || pending || session.calls != 0 {
		t.Fatal("服务器已确认消失的 UID 仍被下载或永久阻塞正文补齐")
	}
	rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 1 || !rows[0].Cached {
		t.Fatal("核对已消失 UID 破坏了其他已保存邮件")
	}
}

type unavailableImageCache struct{ domain.MailRepository }

func (unavailableImageCache) ReadAttachment(context.Context, string) ([]byte, string, error) {
	return nil, "", domain.ErrProtocol
}

func TestStoredBodyRemainsReadableWhenImageCacheUnavailable(t *testing.T) {
	mail, store, _, transport := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal("无法准备离线正文账号")
	}
	awaitSync(t, mail, account.ID)
	rows, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(rows) != 1 {
		t.Fatal("缺少合成持久邮件")
	}
	if err := store.SaveMailBody(t.Context(), rows[0].ID, domain.DecodedMail{
		Text: "offline text", HTML: `<p>offline HTML</p><img src="cid:local@test">`,
		Attachments: []domain.DecodedAttachment{{Filename: "inline.png", MIME: "image/png", ContentID: "local@test", Data: []byte("synthetic image")}},
	}); err != nil {
		t.Fatal("无法保存含图正文")
	}
	transport.authError = domain.ErrNetwork
	mail.store = unavailableImageCache{store}
	detail, err := mail.Message(t.Context(), rows[0].ID)
	if err != nil || detail.Body != "offline text" || !strings.Contains(detail.BodyHTML, "offline HTML") {
		t.Fatal("断网或图片缓存不可读导致数据库正文不可读")
	}
}
