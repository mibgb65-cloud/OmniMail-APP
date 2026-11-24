package syncer

import (
	"context"
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
	"omnimail/internal/mailproto"
	"omnimail/internal/storage"
)

type batchFailSession struct {
	imapserver.Session
	conn           *imapserver.Conn
	failMultiFetch *atomic.Bool
	badSingleUID   imap.UID
}

func (s *batchFailSession) Fetch(w *imapserver.FetchWriter, numSet imap.NumSet, options *imap.FetchOptions) error {
	if len(options.BodySection) > 0 {
		if uidSet, ok := numSet.(imap.UIDSet); ok {
			if s.failMultiFetch.Load() && len(uidSet) > 0 && (len(uidSet) > 1 || uidSet[0].Start != uidSet[0].Stop) {
				_ = s.conn.NetConn().Close()
				return errors.New("qq batch body fetch reset")
			}
			if s.badSingleUID > 0 && uidSet.Contains(s.badSingleUID) {
				return errors.New("corrupt single message")
			}
		}
	}
	return s.Session.Fetch(w, numSet, options)
}

func TestBatchFetchFallbackToSingleMessageAndCheckpointsLastUID(t *testing.T) {
	mem := imapmemserver.New()
	u := imapmemserver.NewUser("qq", "pass")
	_ = u.Create("INBOX", nil)
	for i := 1; i <= 4; i++ {
		raw := fmt.Sprintf("From: a@qq.com\r\nTo: qq@qq.com\r\nMessage-ID: <bf%d@qq.com>\r\nSubject: Msg %d\r\n\r\nBody %d\r\n", i, i, i)
		_, _ = u.Append("INBOX", strings.NewReader(raw), &imap.AppendOptions{Time: time.Now()})
	}
	mem.AddUser(u)

	var failMulti atomic.Bool
	srv := imapserver.New(&imapserver.Options{
		NewSession: func(c *imapserver.Conn) (imapserver.Session, *imapserver.GreetingData, error) {
			return &batchFailSession{Session: mem.NewSession(), conn: c, failMultiFetch: &failMulti, badSingleUID: 3}, nil, nil
		},
		InsecureAuth: true,
	})
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = srv.Close(); _ = ln.Close() })
	go func() { _ = srv.Serve(ln) }()

	reconnect := func() (*imapclient.Client, error) { return dialFixtureIMAP(ln.Addr().String()) }
	cli, err := reconnect()
	if err != nil {
		t.Fatal(err)
	}

	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	_, _ = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-qq','QQ','QQ','qq@qq.com','qq','QQ','password','imap.qq.com',993,'SSL/TLS','smtp.qq.com',465,'SSL/TLS',1)`)

	// 先预设 last_uid = 1（仅已同步 UID 1），随后开启整批拉取断连 + UID 3 单封损坏
	_, _ = db.Exec(`INSERT INTO remote_mailboxes(id,account_id,remote_name,local_folder,uid_validity,last_uid,oldest_uid,history_exhausted,total_count,updated_at)
		VALUES ('acc-qq:INBOX','acc-qq','INBOX','inbox',1,1,1,0,4,1)`)
	failMulti.Store(true)

	acc := accounts.EmailAccountDTO{ID: "acc-qq", Email: "qq@qq.com"}
	mb := mailproto.DiscoveredMailbox{RemoteName: "INBOX", LocalFolder: "inbox"}
	added, finalCli, syncErr := syncSingleMailboxWithOptions(cli, db, nil, nil, nil, acc, mb, syncMailboxOptions{
		Ctx: context.Background(), ProfileDir: dir, Reconnect: reconnect,
	})
	closeIMAPQuietly(finalCli, false)

	// UID 2 与 UID 4 应通过逐封降级成功入库，同时返回 UID 3 错误并记录 message-fetch 日志
	if syncErr == nil || !strings.Contains(syncErr.Error(), "UID=3") {
		t.Fatalf("应返回损坏邮件 UID=3 错误，实际: %v", syncErr)
	}
	if len(added) != 2 {
		t.Fatalf("逐封降级应继续拉取 UID 2 和 UID 4（2 封），实际新增 %d 封", len(added))
	}
	var lastUID uint32
	_ = db.QueryRow(`SELECT last_uid FROM remote_mailboxes WHERE id='acc-qq:INBOX'`).Scan(&lastUID)
	if lastUID != 1 {
		t.Fatalf("批次中存在失败 UID 时不应越过缺口推进 last_uid，实际: %d", lastUID)
	}
	var singleLogCnt int
	_ = db.QueryRow(`SELECT COUNT(1) FROM sync_logs WHERE account_id='acc-qq' AND stage='message-fetch' AND level='error'`).Scan(&singleLogCnt)
	if singleLogCnt != 1 {
		t.Fatalf("应记录 1 条单封失败日志，实际: %d", singleLogCnt)
	}
}
