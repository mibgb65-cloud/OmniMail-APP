package mailrepair

import (
	"database/sql"
	"encoding/json"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"omnimail/internal/mailproto"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

const MigrationVersion = 5

type msgRepairRow struct {
	id, threadID, folder             string
	senderName, senderEmail, subject string
	toJSON, ccJSON, rawHeaders       string
	rawSHA, bodyHTML, securityJSON   string
}

// EnsureLegacyMailRepaired 幂等检查并执行存量邮件编码、安全检测、联系人与 HTML 样式修复。
func EnsureLegacyMailRepaired(db *sql.DB) {
	if db == nil || hasRepairVersion(db) {
		return
	}
	_ = MigrateLegacyMailData(db, discoverBlobStore(db))
}

// MigrateLegacyMailData 在空间打开或首次读取时一次性修复存量乱码邮件头、误报钓鱼标记、畸形联系人及缺失样式的 HTML。
func MigrateLegacyMailData(db *sql.DB, blobs *storage.BlobStore) error {
	if db == nil || hasRepairVersion(db) {
		return nil
	}
	if blobs == nil {
		blobs = discoverBlobStore(db)
	}
	if err := repairMessagesAndPhishing(db, blobs); err != nil {
		return err
	}
	if err := repairMalformedContacts(db); err != nil {
		return err
	}
	if err := repairLegacyHTMLStyles(db, blobs); err != nil {
		return err
	}
	_, err := db.Exec(`INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)`,
		MigrationVersion, time.Now().UnixMilli())
	return err
}

func hasRepairVersion(db *sql.DB) bool {
	var found int
	return db.QueryRow(`SELECT 1 FROM schema_migrations WHERE version = ?`, MigrationVersion).Scan(&found) == nil && found == 1
}

func discoverBlobStore(db *sql.DB) *storage.BlobStore {
	rows, err := db.Query(`PRAGMA database_list`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	for rows.Next() {
		var seq int
		var name, file string
		if rows.Scan(&seq, &name, &file) == nil && name == "main" && file != "" {
			return storage.NewBlobStore(filepath.Dir(file))
		}
	}
	return nil
}

func repairMessagesAndPhishing(db *sql.DB, blobs *storage.BlobStore) error {
	rows, err := db.Query(`
		SELECT id, thread_id, folder, sender_name, sender_email, subject,
		       to_json, cc_json, raw_headers, raw_blob_sha256, body_html_sanitized, security_json
		FROM messages`)
	if err != nil {
		return err
	}
	var candidates []msgRepairRow
	for rows.Next() {
		var r msgRepairRow
		if err := rows.Scan(&r.id, &r.threadID, &r.folder, &r.senderName, &r.senderEmail, &r.subject,
			&r.toJSON, &r.ccJSON, &r.rawHeaders, &r.rawSHA, &r.bodyHTML, &r.securityJSON); err != nil {
			rows.Close()
			return err
		}
		if needsMessageEnvelopeRepair(r) {
			candidates = append(candidates, r)
		}
	}
	rows.Close()

	for _, r := range candidates {
		applySingleMessageRepair(db, blobs, r)
	}
	return nil
}

func needsMessageEnvelopeRepair(r msgRepairRow) bool {
	return hasGarbledText(r.senderName) || strings.ContainsAny(r.senderName, "<>") ||
		hasDirtyEmail(r.senderEmail) || hasGarbledText(r.subject) ||
		hasGarbledText(r.rawHeaders) || hasDirtyAddrJSON(r.toJSON) || hasDirtyAddrJSON(r.ccJSON) ||
		strings.Contains(r.securityJSON, "发件人显示名伪装为其他域名邮箱")
}

func applySingleMessageRepair(db *sql.DB, blobs *storage.BlobStore, r msgRepairRow) {
	rawHdr, rawHTML := r.rawHeaders, r.bodyHTML
	if blobs != nil && r.rawSHA != "" {
		if rawEML, err := blobs.GetRawEML(r.rawSHA); err == nil && len(rawEML) > 0 {
			rawHdr = mailproto.ExtractRawHeaderBlock(rawEML)
			if h := mailproto.ExtractRawBodyHTML(rawEML); h != "" {
				rawHTML = h
			}
		}
	}
	hint := mailproto.DetectHeaderCharsetHint(rawHdr)
	sub, sender, replyTo, to, cc := mailproto.ParseHeaderBlockEnvelope(rawHdr)
	if sender.Email == "" {
		if list := mailproto.ParseAddressHeader(r.senderEmail, hint); len(list) > 0 {
			sender = list[0]
		} else if list := mailproto.ParseAddressHeader(r.senderName, hint); len(list) > 0 {
			sender = list[0]
		}
	}
	if sender.Name == "" && !hasGarbledText(r.senderName) && !strings.ContainsAny(r.senderName, "<>") {
		sender.Name = r.senderName
	}
	if sender.Email == "" && !hasDirtyEmail(r.senderEmail) {
		sender.Email = r.senderEmail
	}
	if sub == "" {
		sub = strings.TrimSpace(mailproto.DecodeHeaderTextWithHint(r.subject, hint))
		if sub == "" {
			sub = "（无主题）"
		}
	}
	toJSON := marshalOrRepairAddrJSON(to, r.toJSON, hint)
	ccJSON := marshalOrRepairAddrJSON(cc, r.ccJSON, hint)
	cleanHdr := mailproto.EnsureUTF8HeaderBytes(rawHdr, hint)

	secJSON := r.securityJSON
	if r.folder != "sent" && r.folder != "drafts" {
		exts, names := loadAttachmentMeta(db, r.id)
		var rtEmails []string
		for _, rt := range replyTo {
			if rt.Email != "" {
				rtEmails = append(rtEmails, rt.Email)
			}
		}
		if warn := security.EvaluatePhishing(security.PhishingCheckInput{
			SenderName: sender.Name, SenderEmail: sender.Email, ReplyToEmails: rtEmails,
			RawHeaders: cleanHdr, BodyHTML: rawHTML, AttachmentExts: exts, AttachmentNames: names,
		}); warn != nil {
			b, _ := json.Marshal(warn)
			secJSON = string(b)
		} else {
			secJSON = ""
		}
	}

	_, _ = db.Exec(`UPDATE messages SET sender_name=?, sender_email=?, to_json=?, cc_json=?, subject=?, raw_headers=?, security_json=? WHERE id=?`,
		sender.Name, sender.Email, toJSON, ccJSON, sub, cleanHdr, secJSON, r.id)
	_, _ = db.Exec(`UPDATE messages_fts SET subject=?, sender_name=?, sender_email=? WHERE message_id=?`,
		sub, sender.Name, sender.Email, r.id)
	if sub != "" && r.threadID != "" {
		_, _ = db.Exec(`UPDATE threads SET subject=? WHERE id=?`, sub, r.threadID)
	}
}

func hasGarbledText(s string) bool {
	return !utf8.ValidString(s) || strings.ContainsRune(s, '\uFFFD')
}

func hasDirtyEmail(s string) bool {
	return s != "" && (hasGarbledText(s) || strings.ContainsAny(s, "<> \t\r\n\"'") || s != strings.ToLower(s))
}
