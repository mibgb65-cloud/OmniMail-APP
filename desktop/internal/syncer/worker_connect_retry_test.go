package syncer

import (
	"context"
	"io"
	"net"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/emersion/go-imap/v2/imapserver"
	"github.com/emersion/go-imap/v2/imapserver/imapmemserver"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

func setupSyncRetryFixture(t *testing.T) (*profilemgr.Session, *events.Bus, string) {
	t.Helper()
	mem := imapmemserver.New()
	user := imapmemserver.NewUser("wilsonlivia@yandex.com", "app-pass-123")
	if err := user.Create("INBOX", nil); err != nil {
		t.Fatal(err)
	}
	mem.AddUser(user)

	srv := imapserver.New(&imapserver.Options{
		NewSession: func(*imapserver.Conn) (imapserver.Session, *imapserver.GreetingData, error) {
			return mem.NewSession(), nil, nil
		},
		InsecureAuth: true,
	})
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = srv.Close()
		_ = ln.Close()
	})
	go func() { _ = srv.Serve(ln) }()

	profDir := t.TempDir()
	db, err := storage.OpenProfileDB(profDir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { storage.CheckpointAndClose(db) })

	vault, err := security.OpenVault("test-sync", profDir)
	if err != nil {
		t.Fatal(err)
	}
	if err := vault.Set(accounts.VaultImapPassKey("acc-yandex"), "app-pass-123"); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO accounts (
		id,name,short_tag,email,provider,provider_label,auth_mode,
		imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at
	) VALUES (
		'acc-yandex','Yandex Mail · wilsonlivia','Yandex','wilsonlivia@yandex.com',
		'yandex','Yandex Mail','app-password','imap.yandex.com',993,'SSL/TLS','smtp.yandex.com',465,'SSL/TLS',1
	)`)
	if err != nil {
		t.Fatal(err)
	}
	sess := &profilemgr.Session{ProfileDir: profDir, DB: db, Vault: vault}
	return sess, events.NewBus(), ln.Addr().String()
}

func dialMemIMAP(addr string) (*imapclient.Client, error) {
	conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
	if err != nil {
		return nil, err
	}
	cli := imapclient.New(conn, nil)
	if err := cli.Login("wilsonlivia@yandex.com", "app-pass-123").Wait(); err != nil {
		_ = cli.Close()
		return nil, err
	}
	return cli, nil
}

func TestConnectTransientEOFRetriesSilentlyAndSucceeds(t *testing.T) {
	sess, bus, addr := setupSyncRetryFixture(t)
	var statuses []events.AccountStatusPayload
	bus.Subscribe(func(name string, payload any) {
		if name == events.AccountStatus {
			statuses = append(statuses, payload.(events.AccountStatusPayload))
		}
	})

	var attempts atomic.Int32
	zero := time.Duration(0)
	w := &SyncWorker{
		accountID:        "acc-yandex",
		sess:             sess,
		bus:              bus,
		ctx:              context.Background(),
		connectBackoffs:  []time.Duration{5 * time.Millisecond, 10 * time.Millisecond},
		connectJitterMax: &zero,
		dialIMAP: func(_ context.Context, _ mailproto.EndpointConfig, _ *imapclient.UnilateralDataHandler) (*imapclient.Client, error) {
			if attempts.Add(1) == 1 {
				return nil, io.ErrUnexpectedEOF
			}
			return dialMemIMAP(addr)
		},
	}

	if err := w.runOneSyncCycle(); err != nil {
		t.Fatalf("首次瞬时 EOF 经静默重试后应成功，实际报错: %v", err)
	}
	if got := attempts.Load(); got != 2 {
		t.Fatalf("预期拨号 2 次（1 次失败 + 1 次重试成功），实际 %d 次", got)
	}
	for _, st := range statuses {
		if st.Status == "error" || st.Status == "auth-expired" {
			t.Fatalf("静默重试成功时绝不应发出异常状态事件: %+v", st)
		}
	}
	dto, err := accounts.GetByID(sess.DB, sess.Vault, "acc-yandex")
	if err != nil || dto.Status != "connected" || dto.LastError != "" {
		t.Fatalf("账户应为 connected 且清空 lastError，实际: %+v (err=%v)", dto, err)
	}
}

func TestConnectExhaustsTwoRetriesThenReportsRealError(t *testing.T) {
	sess, bus, _ := setupSyncRetryFixture(t)
	var lastStatus events.AccountStatusPayload
	bus.Subscribe(func(name string, payload any) {
		if name == events.AccountStatus {
			lastStatus = payload.(events.AccountStatusPayload)
		}
	})

	var attempts atomic.Int32
	zero := time.Duration(0)
	w := &SyncWorker{
		accountID:        "acc-yandex",
		sess:             sess,
		bus:              bus,
		ctx:              context.Background(),
		connectBackoffs:  []time.Duration{5 * time.Millisecond, 10 * time.Millisecond},
		connectJitterMax: &zero,
		dialIMAP: func(_ context.Context, _ mailproto.EndpointConfig, _ *imapclient.UnilateralDataHandler) (*imapclient.Client, error) {
			attempts.Add(1)
			return nil, io.ErrUnexpectedEOF
		},
	}

	if err := w.runOneSyncCycle(); err == nil {
		t.Fatal("连续 3 次失败后应返回错误")
	}
	if got := attempts.Load(); got != 3 {
		t.Fatalf("预期总尝试 3 次（初始 + 2 次退避重试），实际 %d 次", got)
	}
	if lastStatus.Status != "error" || !strings.Contains(lastStatus.LastError, "unexpected EOF") {
		t.Fatalf("预期上报 error 及真实错误原因，实际: %+v", lastStatus)
	}
	dto, _ := accounts.GetByID(sess.DB, sess.Vault, "acc-yandex")
	if dto.Status != "error" || !strings.Contains(dto.LastError, "IMAP 993") {
		t.Fatalf("DTO 未持久化真实阶段错误摘要: %+v", dto)
	}
}

func TestConnectAuthExpiredDoesNotRetry(t *testing.T) {
	sess, bus, _ := setupSyncRetryFixture(t)
	var lastStatus events.AccountStatusPayload
	bus.Subscribe(func(name string, payload any) {
		if name == events.AccountStatus {
			lastStatus = payload.(events.AccountStatusPayload)
		}
	})

	var attempts atomic.Int32
	zero := time.Duration(0)
	w := &SyncWorker{
		accountID:        "acc-yandex",
		sess:             sess,
		bus:              bus,
		ctx:              context.Background(),
		connectBackoffs:  []time.Duration{50 * time.Millisecond, 50 * time.Millisecond},
		connectJitterMax: &zero,
		dialIMAP: func(_ context.Context, _ mailproto.EndpointConfig, _ *imapclient.UnilateralDataHandler) (*imapclient.Client, error) {
			attempts.Add(1)
			return nil, apperr.New(apperr.CodeAuthExpired, "邮箱授权已失效或被撤销")
		},
	}

	if err := w.runOneSyncCycle(); apperr.CodeOf(err) != apperr.CodeAuthExpired {
		t.Fatalf("预期返回 CodeAuthExpired，实际: %v", err)
	}
	if got := attempts.Load(); got != 1 {
		t.Fatalf("CodeAuthExpired 不得静默重试，实际尝试 %d 次", got)
	}
	if lastStatus.Status != "auth-expired" {
		t.Fatalf("预期上报 auth-expired，实际: %+v", lastStatus)
	}
}
