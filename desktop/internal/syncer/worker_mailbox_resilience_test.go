package syncer

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/emersion/go-imap/v2/imapserver"
	"github.com/emersion/go-imap/v2/imapserver/imapmemserver"

	"omnimail/internal/accounts"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/profilemgr"
	"omnimail/internal/storage"
)

type interceptSession struct {
	imapserver.Session
	conn               *imapserver.Conn
	dropOnInboxSelect  *atomic.Bool
	forbidNewUIDFetch  *atomic.Bool
	maxKnownUID        imap.UID
	forbiddenFetchHits *atomic.Int32
}

func (s *interceptSession) Select(mailbox string, options *imap.SelectOptions) (*imap.SelectData, error) {
	if s.dropOnInboxSelect != nil && s.dropOnInboxSelect.Load() && strings.EqualFold(mailbox, "INBOX") {
		_ = s.conn.NetConn().Close()
		return nil, errors.New("simulated qq imap drop")
	}
	return s.Session.Select(mailbox, options)
}

func (s *interceptSession) Fetch(w *imapserver.FetchWriter, numSet imap.NumSet, options *imap.FetchOptions) error {
	if s.forbidNewUIDFetch != nil && s.forbidNewUIDFetch.Load() {
		if uidSet, ok := numSet.(imap.UIDSet); ok && uidSet.Contains(s.maxKnownUID+1) {
			s.forbiddenFetchHits.Add(1)
			return errors.New("QQ IMAP BAD invalid UID range")
		}
	}
	return s.Session.Fetch(w, numSet, options)
}

func startInterceptIMAP(t *testing.T, mem *imapmemserver.Server, dropInbox, forbidNewFetch *atomic.Bool, maxUID imap.UID, hits *atomic.Int32) string {
	t.Helper()
	srv := imapserver.New(&imapserver.Options{
		NewSession: func(c *imapserver.Conn) (imapserver.Session, *imapserver.GreetingData, error) {
			return &interceptSession{
				Session:            mem.NewSession(),
				conn:               c,
				dropOnInboxSelect:  dropInbox,
				forbidNewUIDFetch:  forbidNewFetch,
				maxKnownUID:        maxUID,
				forbiddenFetchHits: hits,
			}, nil, nil
		},
		InsecureAuth: true,
	})
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = srv.Close(); _ = ln.Close() })
	go func() { _ = srv.Serve(ln) }()
	return ln.Addr().String()
}

func dialFixtureIMAP(addr string) (*imapclient.Client, error) {
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return nil, err
	}
	cli := imapclient.New(conn, nil)
	if err := cli.Login("qq", "pass").Wait(); err != nil {
		_ = cli.Close()
		return nil, err
	}
	return cli, nil
}

func openTestQQDB(t *testing.T) (string, *sql.DB) {
	t.Helper()
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = storage.CheckpointAndClose(db) })
	_, _ = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-qq','QQ','QQ','qq@qq.com','qq','QQ','password','imap.qq.com',993,'SSL/TLS','smtp.qq.com',465,'SSL/TLS',1)`)
	return dir, db
}

func TestIncrementalUIDNextShortCircuitSkipsEmptyFetch(t *testing.T) {
	mem := imapmemserver.New()
	u := imapmemserver.NewUser("qq", "pass")
	_ = u.Create("INBOX", nil)
	for i := 1; i <= 3; i++ {
		raw := fmt.Sprintf("From: a@qq.com\r\nTo: qq@qq.com\r\nMessage-ID: <m%d@qq.com>\r\nSubject: Hi %d\r\n\r\nBody\r\n", i, i)
		_, _ = u.Append("INBOX", strings.NewReader(raw), &imap.AppendOptions{Time: time.Now()})
	}
	mem.AddUser(u)

	var forbid atomic.Bool
	var hits atomic.Int32
	addr := startInterceptIMAP(t, mem, nil, &forbid, 3, &hits)
	cli, err := dialFixtureIMAP(addr)
	if err != nil {
		t.Fatal(err)
	}
	defer cli.Close()

	_, db := openTestQQDB(t)
	acc := accounts.EmailAccountDTO{ID: "acc-qq", Email: "qq@qq.com"}
	mb := mailproto.DiscoveredMailbox{RemoteName: "INBOX", LocalFolder: "inbox"}

	added, _, err := syncSingleMailboxWithOptions(cli, db, nil, nil, nil, acc, mb, syncMailboxOptions{Ctx: context.Background()})
	if err != nil || len(added) != 3 {
		t.Fatalf("首次同步失败: added=%d err=%v", len(added), err)
	}

	forbid.Store(true)
	added2, _, err := syncSingleMailboxWithOptions(cli, db, nil, nil, nil, acc, mb, syncMailboxOptions{Ctx: context.Background()})
	if err != nil || len(added2) != 0 || hits.Load() != 0 {
		t.Fatalf("UIDNext 短路未生效: added=%d hits=%d err=%v", len(added2), hits.Load(), err)
	}
	if !shouldSkipIncrementalDiscovery(100, 101) || shouldSkipIncrementalDiscovery(100, 102) {
		t.Fatalf("UIDNext 短路边界判断错误")
	}
	if compact := buildCompactUIDSet([]imap.UID{1, 2, 3, 7, 8, 12}); len(compact) != 3 {
		t.Fatalf("UID 连续区间压缩失败，期望 3 段，实际 %d 段: %v", len(compact), compact)
	}
}

func TestSingleFolderDropReconnectsAndWritesSyncLogs(t *testing.T) {
	mem := imapmemserver.New()
	u := imapmemserver.NewUser("qq", "pass")
	_ = u.Create("INBOX", nil)
	_ = u.Create("Sent", nil)
	_, _ = u.Append("Sent", strings.NewReader("From: qq@qq.com\r\nTo: b@qq.com\r\nMessage-ID: <s1@qq.com>\r\nSubject: Sent1\r\n\r\nOK\r\n"), &imap.AppendOptions{Time: time.Now()})
	mem.AddUser(u)

	var dropInbox atomic.Bool
	dropInbox.Store(true)
	addr := startInterceptIMAP(t, mem, &dropInbox, nil, 0, nil)

	var reconnects atomic.Int32
	reconnect := func() (*imapclient.Client, error) {
		reconnects.Add(1)
		return dialFixtureIMAP(addr)
	}
	initConn, err := dialFixtureIMAP(addr)
	if err != nil {
		t.Fatal(err)
	}

	dir, db := openTestQQDB(t)
	w := SyncWorker{
		accountID: "acc-qq",
		sess:      &profilemgr.Session{ProfileDir: dir, DB: db},
		bus:       events.NewBus(),
		ctx:       context.Background(),
	}
	boxes := []mailproto.DiscoveredMailbox{
		{RemoteName: "INBOX", LocalFolder: "inbox"},
		{RemoteName: "Sent", LocalFolder: "sent"},
	}
	added, syncedBox, failedBox, folderErrs, finalConn := w.syncBoxesWithReconnect(
		initConn, accounts.EmailAccountDTO{ID: "acc-qq", Email: "qq@qq.com"}, boxes, reconnect,
	)
	closeIMAPQuietly(finalConn, false)

	if !failedBox || !syncedBox || len(added) != 1 || reconnects.Load() == 0 {
		t.Fatalf("期望 INBOX 断连后重连并成功同步 Sent: failed=%v synced=%v added=%d reconnects=%d", failedBox, syncedBox, len(added), reconnects.Load())
	}

	w.finishSyncProgress(syncedBox, failedBox, summarizeFolderErrors(folderErrs))

	var lastErr, logMsg, logDetail string
	_ = db.QueryRow(`SELECT last_error FROM accounts WHERE id='acc-qq'`).Scan(&lastErr)
	if !strings.Contains(lastErr, "INBOX 同步失败:") {
		t.Fatalf("accounts.last_error 应记录具体文件夹错误，实际: %q", lastErr)
	}
	err = db.QueryRow(`SELECT message, detail FROM sync_logs WHERE account_id='acc-qq' AND level='error' AND stage='folder-sync' ORDER BY id DESC LIMIT 1`).Scan(&logMsg, &logDetail)
	if err != nil || !strings.Contains(logMsg, "INBOX") || logDetail == "" {
		t.Fatalf("文件夹同步错误未写入 sync_logs: err=%v msg=%q detail=%q", err, logMsg, logDetail)
	}
}
