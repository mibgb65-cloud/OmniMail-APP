package storage

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"

	"omnimail/internal/security"
)

func TestOpenProfileDBWALAndFTS5Trigram(t *testing.T) {
	dir := t.TempDir()
	db, err := OpenProfileDB(dir)
	if err != nil {
		t.Fatalf("OpenProfileDB 失败: %v", err)
	}
	defer CheckpointAndClose(db)

	var mode string
	if err := db.QueryRow(`PRAGMA journal_mode;`).Scan(&mode); err != nil || strings.ToLower(mode) != "wal" {
		t.Fatalf("期望 WAL 模式，实际: %q (err=%v)", mode, err)
	}
	var fk int
	if err := db.QueryRow(`PRAGMA foreign_keys;`).Scan(&fk); err != nil || fk != 1 {
		t.Fatalf("期望 foreign_keys=1，实际: %d", fk)
	}

	// 验证 FTS5 trigram 虚拟表支持中文三元组检索
	if _, err := db.Exec(`INSERT INTO messages_fts(message_id, subject, sender_name, sender_email, body_text, attachment_names)
		VALUES ('m1', '季度财务预算评审通知', '林知夏', 'zhixia@studio.example', '请在本周五前确认桌面端发版清单', 'budget.pdf')`); err != nil {
		t.Fatalf("写入 messages_fts 失败: %v", err)
	}
	var hitID string
	if err := db.QueryRow(`SELECT message_id FROM messages_fts WHERE messages_fts MATCH '"财务预算"'`).Scan(&hitID); err != nil || hitID != "m1" {
		t.Fatalf("FTS5 trigram 中文检索失败: hit=%q err=%v", hitID, err)
	}
}

func TestCASZstdAndBackupWithoutPlainSecrets(t *testing.T) {
	dir := t.TempDir()
	db, err := OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer CheckpointAndClose(db)

	vault, err := security.OpenVault("personal", dir)
	if err != nil {
		t.Fatal(err)
	}
	_ = vault.Set("account:a1:imap_pass", "NeverExportPlaintext999")

	blobs := NewBlobStore(dir)
	rawEML := []byte("From: sender@example.com\r\nSubject: Zstd CAS Test\r\n\r\nBody content repeated repeated repeated!")
	shaHex, err := blobs.PutRawEML(rawEML)
	if err != nil {
		t.Fatalf("PutRawEML 失败: %v", err)
	}
	decoded, err := blobs.GetRawEML(shaHex)
	if err != nil || !bytes.Equal(decoded, rawEML) {
		t.Fatalf("GetRawEML 解压还原不一致: err=%v", err)
	}

	attSha, size, _, err := blobs.PutAttachment(strings.NewReader("attachment-binary-payload"))
	if err != nil || size != 25 || len(attSha) != 64 {
		t.Fatalf("PutAttachment 失败: sha=%s size=%d err=%v", attSha, size, err)
	}

	zipPath, err := ExportProfileZip(db, vault, "personal", dir, ExportBackupOptions{
		IncludeAttachments: true,
		IncludeSecrets:     false,
	})
	if err != nil {
		t.Fatalf("ExportProfileZip 失败: %v", err)
	}
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	defer zr.Close()
	for _, f := range zr.File {
		if strings.Contains(f.Name, "secrets.vault") {
			t.Fatalf("默认备份不应包含凭据文件: %s", f.Name)
		}
	}
}
