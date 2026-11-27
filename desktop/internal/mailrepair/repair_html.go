package mailrepair

import (
	"database/sql"
	"strings"

	"omnimail/internal/mailproto"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

// repairLegacyHTMLStyles 从本地原始 .eml.zst 重新净化丢失 <style> 或 class 的存量 HTML 邮件。
func repairLegacyHTMLStyles(db *sql.DB, blobs *storage.BlobStore) error {
	if blobs == nil {
		return nil
	}
	rows, err := db.Query(`
		SELECT id, raw_blob_sha256 FROM messages
		WHERE raw_blob_sha256 != '' AND body_html_sanitized != ''
		  AND INSTR(LOWER(body_html_sanitized), '<style') = 0`)
	if err != nil {
		return err
	}
	var ids, shas []string
	for rows.Next() {
		var id, sha string
		if rows.Scan(&id, &sha) == nil {
			ids, shas = append(ids, id), append(shas, sha)
		}
	}
	rows.Close()
	for i := range ids {
		RebuildMessageHTMLFromBlob(db, blobs, ids[i], shas[i])
	}
	return nil
}

// RebuildMessageHTMLFromBlob 从单封邮件的 CAS .eml.zst 重建保留安全 <style> 与 class 的 HTML。
func RebuildMessageHTMLFromBlob(db *sql.DB, blobs *storage.BlobStore, msgID, rawSHA string) string {
	if db == nil || blobs == nil || rawSHA == "" {
		return ""
	}
	rawBytes, err := blobs.GetRawEML(rawSHA)
	if err != nil || len(rawBytes) == 0 {
		return ""
	}
	rawHTML := mailproto.ExtractRawBodyHTML(rawBytes)
	if strings.TrimSpace(rawHTML) == "" {
		return ""
	}
	lowRaw := strings.ToLower(rawHTML)
	if !strings.Contains(lowRaw, "<style") && !strings.Contains(lowRaw, "class=") &&
		!strings.Contains(lowRaw, "scope=") && !strings.Contains(lowRaw, "url(") && !strings.Contains(lowRaw, "background=") {
		return ""
	}
	sanitized, hasRemote := security.SanitizeMailHTML(rawHTML, loadMessageCIDs(db, msgID))
	if sanitized == "" {
		return ""
	}
	remInt := 0
	if hasRemote {
		remInt = 1
	}
	_, _ = db.Exec(`UPDATE messages SET body_html_sanitized = ?, has_remote_images = CASE WHEN ? = 1 THEN 1 ELSE has_remote_images END WHERE id = ?`,
		sanitized, remInt, msgID)
	return sanitized
}

// TryLazyRebuildHTML 按需从本地原始 .eml.zst 恢复单封邮件缺失的 <style> 与 class（供详情读取兜底使用）。
func TryLazyRebuildHTML(db *sql.DB, msgID string) string {
	var rawSHA string
	if db == nil || db.QueryRow(`SELECT raw_blob_sha256 FROM messages WHERE id = ?`, msgID).Scan(&rawSHA) != nil || rawSHA == "" {
		return ""
	}
	return RebuildMessageHTMLFromBlob(db, discoverBlobStore(db), msgID, rawSHA)
}

func loadMessageCIDs(db *sql.DB, msgID string) map[string]string {
	rows, err := db.Query(`SELECT id, content_id FROM attachments WHERE message_id = ? AND content_id != ''`, msgID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := make(map[string]string)
	for rows.Next() {
		var id, cid string
		if rows.Scan(&id, &cid) == nil {
			if nk := security.NormalizeContentID(cid); nk != "" {
				out[nk] = id
			}
		}
	}
	return out
}
