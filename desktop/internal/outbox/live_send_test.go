//go:build live

package outbox

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"omnimail/internal/accounts"
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

type extAccountPair struct {
	email  string
	secret string
}

func readLiveAccountPairs(path string) ([]extAccountPair, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.ReplaceAll(string(raw), "\r\n", "\n"), "\n")
	var out []extAccountPair
	var curEmail string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		val := trimmed
		if idx := strings.Index(trimmed, "："); idx >= 0 {
			val = strings.TrimSpace(trimmed[idx+len("："):])
		} else if idx := strings.IndexByte(trimmed, ':'); idx >= 0 {
			val = strings.TrimSpace(trimmed[idx+1:])
		}
		if strings.Contains(val, "@") {
			curEmail = val
		} else if curEmail != "" && val != "" {
			out = append(out, extAccountPair{email: curEmail, secret: val})
			curEmail = ""
		}
	}
	return out, nil
}

// TestLiveSmokeSelfSendSingleEmail 严格仅选取 1 个可达测试邮箱向自身发送 1 封冒烟纯文本测试信。
func TestLiveSmokeSelfSendSingleEmail(t *testing.T) {
	extPath := strings.TrimSpace(os.Getenv("OMNIMAIL_LIVE_ACCOUNTS_FILE"))
	if extPath == "" {
		t.Skip("未设置 OMNIMAIL_LIVE_ACCOUNTS_FILE，跳过真机发信冒烟测试")
	}
	pairs, err := readLiveAccountPairs(extPath)
	if err != nil || len(pairs) == 0 {
		t.Fatalf("读取外部测试账号失败: %v", err)
	}

	var chosen *extAccountPair
	var chosenPreset mailproto.ProviderPreset
	for i := range pairs {
		p := mailproto.ResolveProviderByEmail(pairs[i].email)
		if p.ID != "netease" && p.ID != "gmail" {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		rep := mailproto.TestConnection(ctx, mailproto.EndpointConfig{
			Provider: p.ID, Email: pairs[i].email, AuthMode: "app-password", Secret: pairs[i].secret,
			ImapHost: p.DefaultImapHost, ImapPort: p.DefaultImapPort, ImapSecurity: p.DefaultImapSecurity,
			SmtpHost: p.DefaultSmtpHost, SmtpPort: p.DefaultSmtpPort, SmtpSecurity: p.DefaultSmtpSecurity,
		})
		cancel()
		if rep.OK {
			chosen = &pairs[i]
			chosenPreset = p
			break
		}
	}
	if chosen == nil {
		t.Skip("未找到当前网络可达的 Gmail/163 冒烟账号")
	}

	tmpDir := t.TempDir()
	db, err := storage.OpenProfileDB(tmpDir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	vault, err := security.OpenVault("live-smoke", tmpDir)
	if err != nil {
		t.Fatal(err)
	}
	blobs := storage.NewBlobStore(tmpDir)
	_ = config.SaveProfileSettings(tmpDir, config.DefaultAppSettings())

	acc, err := accounts.Create(db, vault, accounts.ConnectRequest{
		Provider: chosenPreset.ID, Name: chosenPreset.Name, Email: chosen.email,
		AuthMode: "app-password", Secret: chosen.secret, SkipProbe: true,
	})
	if err != nil {
		t.Fatalf("创建临时冒烟账号失败: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	sess := &profilemgr.Session{
		Meta: config.ProfileMeta{ID: "live-smoke", Name: "Smoke"}, ProfileDir: tmpDir,
		DB: db, Vault: vault, Blobs: blobs, Ctx: ctx, Cancel: cancel,
	}

	draft, err := CreateDraft(db, config.DefaultAppSettings(), CreateDraftRequest{
		Mode:      "new",
		AccountID: acc.ID,
		PrefillTo: []string{chosen.email},
		Subject:   "[OmniMail Live Smoke Test]",
		Body:      "OmniMail automated non-destructive self-send protocol verification.",
	})
	if err != nil {
		t.Fatalf("CreateDraft failed: %v", err)
	}

	sched := NewScheduler(oauth.NewTokenManager(), events.NewBus())
	job, err := sched.SendDraft(sess, SendDraftRequest{DraftID: draft.ID, BypassUndoWindow: true})
	if err != nil {
		t.Fatalf("SendDraft failed: %v", err)
	}
	sched.processDueJobs(ctx, sess)

	var state, rfcID, lastErr string
	_ = db.QueryRow(`SELECT state, rfc_message_id, last_error FROM outbox_jobs WHERE id=?`, job.ID).Scan(&state, &rfcID, &lastErr)
	masked := security.MaskEmail(chosen.email)
	if state != "sent" {
		t.Fatalf("provider=%s masked=%s live SMTP send failed: state=%s err=%s",
			chosenPreset.ID, masked, state, security.RedactSensitive(lastErr))
	}

	var sentCount int
	_ = db.QueryRow(`SELECT COUNT(1) FROM messages WHERE account_id=? AND folder='sent' AND rfc_message_id=?`, acc.ID, rfcID).Scan(&sentCount)
	if sentCount != 1 {
		t.Fatalf("expected exactly 1 local sent record with rfc_message_id, got %d", sentCount)
	}
	t.Logf("LIVE SMOKE SELF-SEND OK: provider=%s masked=%s state=%s sent_dedup_ready=true", chosenPreset.ID, masked, state)
}
