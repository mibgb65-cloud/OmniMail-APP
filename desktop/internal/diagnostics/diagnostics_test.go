package diagnostics

import (
	"archive/zip"
	"io"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

func TestPhishingHeuristicsAndDiagnosticBundleRedaction(t *testing.T) {
	// 1. 验证钓鱼启发式评分（DMARC fail + 显示名伪装 + 锚文本跳转不符 + 高危附件）
	warn := security.EvaluatePhishing(security.PhishingCheckInput{
		SenderName:      "security@apple.com",
		SenderEmail:     "attacker@xn--pple-43d.xyz",
		RawHeaders:      "Authentication-Results: mx.google.com; spf=fail; dkim=fail; dmarc=fail\r\n",
		BodyHTML:        `<a href="https://evil.xyz/login">https://apple.com/verify</a>`,
		AttachmentNames: []string{"statement.pdf.exe"},
	})
	if warn == nil || warn.Level != "danger" || warn.DMARC != "fail" {
		t.Fatalf("expected high-risk danger phishing warning, got %+v", warn)
	}

	// 正常认证通过的邮件不应误报
	clean := security.EvaluatePhishing(security.PhishingCheckInput{
		SenderName:  "GitHub",
		SenderEmail: "notifications@github.com",
		RawHeaders:  "Authentication-Results: mx.example.com; spf=pass; dkim=pass; dmarc=pass\r\n",
		BodyHTML:    `<p>Normal notification <a href="https://github.com/pulls">Pull Request</a></p>`,
	})
	if clean != nil {
		t.Fatalf("expected clean mail to have nil warning, got %+v", clean)
	}

	// 2. 验证诊断日志与导出的 .zip 诊断包强制脱敏且不含 secrets.vault
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	vault, _ := security.OpenVault("diag-test", dir)
	_ = vault.Set("account:acc-1:imap_pass", "SUPER_SECRET_PASSWORD_999")

	_, _ = db.Exec(`
		INSERT INTO sync_logs(account_id, protocol, level, stage, duration_ms, message, detail, created_at)
		VALUES ('acc-1', 'IMAP', 'ERROR', 'LOGIN', 42, 'LOGIN user@corp.com SUPER_SECRET_PASSWORD_999', 'Authorization: Bearer ya29.secret_oauth_token sk-abcdef1234567890', ?)
	`, time.Now().UnixMilli())

	sess := &profilemgr.Session{ProfileDir: dir, DB: db, Vault: vault, Blobs: storage.NewBlobStore(dir)}
	zipPath, err := ExportDiagnosticBundle(sess, filepath.Join(dir, "diag.zip"))
	if err != nil {
		t.Fatalf("ExportDiagnosticBundle failed: %v", err)
	}

	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatalf("open exported zip: %v", err)
	}
	defer zr.Close()

	for _, f := range zr.File {
		if strings.Contains(strings.ToLower(f.Name), "vault") {
			t.Fatalf("SECURITY VIOLATION: secrets.vault included in diagnostic zip: %s", f.Name)
		}
		rc, _ := f.Open()
		body, _ := io.ReadAll(rc)
		_ = rc.Close()
		txt := string(body)
		for _, secret := range []string{"SUPER_SECRET_PASSWORD_999", "ya29.secret_oauth_token", "sk-abcdef1234567890"} {
			if strings.Contains(txt, secret) {
				t.Fatalf("SECURITY VIOLATION: plaintext secret %q leaked in %s:\n%s", secret, f.Name, txt)
			}
		}
	}
}
