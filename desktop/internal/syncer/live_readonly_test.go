//go:build live

package syncer

import (
	"context"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/emersion/go-imap/v2"

	"omnimail/internal/mailproto"
	"omnimail/internal/search"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

type liveAccountCred struct {
	email  string
	secret string
}

func parseExternalAccountsFile(path string) ([]liveAccountCred, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.ReplaceAll(string(raw), "\r\n", "\n"), "\n")
	var out []liveAccountCred
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
			out = append(out, liveAccountCred{email: curEmail, secret: val})
			curEmail = ""
		}
	}
	return out, nil
}

func TestLiveReadOnlySevenProviders(t *testing.T) {
	extPath := strings.TrimSpace(os.Getenv("OMNIMAIL_LIVE_ACCOUNTS_FILE"))
	if extPath == "" {
		t.Skip("未设置 OMNIMAIL_LIVE_ACCOUNTS_FILE，跳过真机连通测试")
	}
	creds, err := parseExternalAccountsFile(extPath)
	if err != nil {
		t.Fatalf("读取外部测试账号文件失败: %v", err)
	}
	if len(creds) == 0 {
		t.Fatal("未从外部文件中解析出任何测试账号")
	}

	tmpDir := t.TempDir()
	db, err := storage.OpenProfileDB(tmpDir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	blobs := storage.NewBlobStore(tmpDir)

	reachableCount := 0
	for idx, c := range creds {
		masked := security.MaskEmail(c.email)
		preset := mailproto.ResolveProviderByEmail(c.email)
		accID := "live-" + preset.ID

		cfg := mailproto.EndpointConfig{
			Provider:     preset.ID,
			Email:        c.email,
			AuthMode:     "app-password",
			Secret:       c.secret,
			ImapHost:     preset.DefaultImapHost,
			ImapPort:     preset.DefaultImapPort,
			ImapSecurity: preset.DefaultImapSecurity,
			SmtpHost:     preset.DefaultSmtpHost,
			SmtpPort:     preset.DefaultSmtpPort,
			SmtpSecurity: preset.DefaultSmtpSecurity,
		}

		ctx, cancel := context.WithTimeout(context.Background(), 22*time.Second)
		report := mailproto.TestConnection(ctx, cfg)
		cancel()

		// 若默认 465 SSL SMTP 失败但 IMAP 已通，自动探测 587 STARTTLS 兼容性
		if !report.OK && len(report.Steps) == 4 && report.Steps[2].OK && !report.Steps[3].OK && cfg.SmtpPort == 465 {
			cfg.SmtpPort = 587
			cfg.SmtpSecurity = "STARTTLS"
			ctx2, cancel2 := context.WithTimeout(context.Background(), 18*time.Second)
			report = mailproto.TestConnection(ctx2, cfg)
			cancel2()
		}

		if !report.OK {
			failedStage := "unknown"
			detail := report.Summary
			for _, st := range report.Steps {
				if !st.OK {
					failedStage = st.Stage
					detail = st.Detail
					break
				}
			}
			t.Logf("[%d/%d] provider=%s masked=%s status=UNREACHABLE_OR_FAILED stage=%s detail=%s",
				idx+1, len(creds), preset.ID, masked, failedStage, security.RedactSensitive(detail))
			continue
		}

		reachableCount++
		_, _ = db.Exec(`INSERT OR REPLACE INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			accID, preset.Name, preset.ID, masked, preset.ID, preset.Name, "app-password",
			cfg.ImapHost, cfg.ImapPort, cfg.ImapSecurity, cfg.SmtpHost, cfg.SmtpPort, cfg.SmtpSecurity, time.Now().UnixMilli())

		readCtx, readCancel := context.WithTimeout(context.Background(), 25*time.Second)
		cli, dialErr := mailproto.ConnectIMAP(readCtx, cfg, nil)
		if dialErr != nil {
			readCancel()
			t.Logf("[%d/%d] provider=%s masked=%s二次连接失败: %s", idx+1, len(creds), preset.ID, masked, security.RedactSensitive(dialErr.Error()))
			continue
		}

		boxes, _ := mailproto.DiscoverMailboxes(cli)
		mappedFolders := make([]string, 0)
		for _, b := range boxes {
			if b.LocalFolder != "custom" {
				mappedFolders = append(mappedFolders, b.LocalFolder)
			}
		}

		pulled := 0
		if sel, selErr := cli.Select("INBOX", &imap.SelectOptions{ReadOnly: true}).Wait(); selErr == nil && sel.NumMessages > 0 {
			var seq imap.SeqSet
			start := uint32(1)
			if sel.NumMessages > 5 {
				start = sel.NumMessages - 4
			}
			seq.AddRange(start, sel.NumMessages)
			bodySec := &imap.FetchItemBodySection{Peek: true}
			fetched, fErr := cli.Fetch(seq, &imap.FetchOptions{
				UID: true, Flags: true, InternalDate: true, RFC822Size: true,
				BodySection: []*imap.FetchItemBodySection{bodySec},
			}).Collect()
			if fErr == nil {
				sort.Slice(fetched, func(i, j int) bool { return fetched[i].UID > fetched[j].UID })
				for _, fm := range fetched {
					raw := fm.FindBodySection(bodySec)
					if len(raw) == 0 {
						continue
					}
					if _, ok, ingErr := IngestMessage(db, blobs, nil, IngestInput{
						AccountID: accID, AccountEmail: masked, RemoteMailboxID: accID + ":INBOX",
						RemoteUID: uint32(fm.UID), Folder: "inbox", IsUnread: true,
						ReceivedAt: fm.InternalDate, RawBytes: raw, SizeBytes: fm.RFC822Size,
					}); ingErr == nil && ok {
						pulled++
					}
				}
			}
		}
		_ = cli.Logout().Wait()
		_ = cli.Close()
		readCancel()

		page, _ := search.ListMessages(db, search.MailSearchQuery{AccountIDs: []string{accID}, Folder: "inbox"}, true)
		t.Logf("[%d/%d] provider=%s masked=%s imap=%s:%d smtp=%s:%d status=OK boxes=%d mapped=%v pulled=%d indexed=%d",
			idx+1, len(creds), preset.ID, masked, cfg.ImapHost, cfg.ImapPort, cfg.SmtpHost, cfg.SmtpPort,
			len(boxes), mappedFolders, pulled, page.TotalCount)
	}

	if reachableCount == 0 {
		t.Log("警告：当前网络环境下全部外部测试邮局均连接超时")
	}
}
