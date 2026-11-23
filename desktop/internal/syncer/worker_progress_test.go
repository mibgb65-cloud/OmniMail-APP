package syncer

import (
	"fmt"
	"net"
	"strings"
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

func TestInboxProgressReportsRealCountsForAccount(t *testing.T) {
	mem := imapmemserver.New()
	user := imapmemserver.NewUser("fixture", "test-only")
	if err := user.Create("INBOX", nil); err != nil {
		t.Fatal(err)
	}
	want := syncBatchSize + 2
	for i := range want {
		raw := fmt.Sprintf("From: sender@example.com\r\nTo: fixture@example.com\r\nMessage-ID: <%d@example.com>\r\nSubject: fixture %d\r\n\r\nBody\r\n", i, i)
		if _, err := user.Append("INBOX", strings.NewReader(raw), &imap.AppendOptions{Time: time.Now()}); err != nil {
			t.Fatal(err)
		}
	}
	mem.AddUser(user)

	server := imapserver.New(&imapserver.Options{
		NewSession: func(*imapserver.Conn) (imapserver.Session, *imapserver.GreetingData, error) {
			return mem.NewSession(), nil, nil
		},
		InsecureAuth: true,
	})
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = server.Close(); _ = listener.Close() })
	go func() { _ = server.Serve(listener) }()
	conn, err := net.DialTimeout("tcp", listener.Addr().String(), 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	client := imapclient.New(conn, nil)
	t.Cleanup(func() { _ = client.Close() })
	if err := client.Login("fixture", "test-only").Wait(); err != nil {
		t.Fatal(err)
	}

	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	_, err = db.Exec(`INSERT INTO accounts (id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-new','Test','Test','fixture@example.com','imap','IMAP','password','imap.example.com',993,'SSL/TLS','smtp.example.com',465,'SSL/TLS',1)`)
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus()
	var reports []events.SyncProgressPayload
	bus.Subscribe(func(name string, payload any) {
		if name == events.SyncProgress {
			reports = append(reports, payload.(events.SyncProgressPayload))
		}
	})

	added, err := syncSingleMailbox(client, db, nil, nil, bus, accounts.EmailAccountDTO{ID: "acc-new", Email: "fixture@example.com"},
		mailproto.DiscoveredMailbox{RemoteName: "INBOX", LocalFolder: "inbox"})
	if err != nil || len(added) != want {
		t.Fatalf("新增邮件数为 %d，应为 %d：%v", len(added), want, err)
	}
	if len(reports) != 3 {
		t.Fatalf("预期初始计数及两次批处理进度，实际收到 %d 条", len(reports))
	}
	for i, current := range []int{0, syncBatchSize, want} {
		p := reports[i]
		if p.AccountID != "acc-new" || p.Status != "syncing" || p.Total != want || p.Current != current {
			t.Fatalf("第 %d 批进度不符：%+v", i+1, p)
		}
	}
}

func TestSyncCompletionDoesNotFabricateMessageCounts(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	bus := events.NewBus()
	var last events.SyncProgressPayload
	bus.Subscribe(func(name string, payload any) {
		if name == events.SyncProgress {
			last = payload.(events.SyncProgressPayload)
		}
	})
	w := SyncWorker{accountID: "acc", sess: &profilemgr.Session{DB: db}, bus: bus}
	for _, tc := range []struct {
		ok, failed bool
		status     string
	}{{false, false, "done"}, {true, true, "partial"}, {false, true, "failed"}} {
		w.finishSyncProgress(tc.ok, tc.failed)
		if last.AccountID != "acc" || last.Status != tc.status || last.Current != 0 || last.Total != 0 {
			t.Fatalf("同步结束状态不符：%+v，应为 %s 且不附带虚构计数", last, tc.status)
		}
	}
}
