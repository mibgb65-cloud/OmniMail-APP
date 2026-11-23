package contacts

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"strings"
	"time"

	"omnimail/internal/mailproto"
)

var automatedPrefixes = []string{
	"noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
	"mailer-daemon", "postmaster", "bounce", "bounces", "notification", "notifications",
}

func IsAutomatedAddress(email string) bool {
	low := strings.ToLower(strings.TrimSpace(email))
	at := strings.IndexByte(low, '@')
	if at <= 0 {
		return true
	}
	local := low[:at]
	for _, p := range automatedPrefixes {
		if local == p || strings.HasPrefix(local, p+"+") || strings.HasPrefix(local, p+"-") {
			return true
		}
	}
	return false
}

// ExtractFromMessage 从新入库邮件中自动提取往来联系人（绝不覆盖用户手动编辑记录）。
func ExtractFromMessage(db *sql.DB, accountID, selfEmail string, parsed *mailproto.ParsedEmail) {
	if db == nil || parsed == nil {
		return
	}
	all := make([]mailproto.EmailAddress, 0, 1+len(parsed.To)+len(parsed.Cc))
	all = append(all, parsed.Sender)
	all = append(all, parsed.To...)
	all = append(all, parsed.Cc...)
	ts := parsed.SentAt.UnixMilli()
	if ts <= 0 {
		ts = time.Now().UnixMilli()
	}
	for _, addr := range all {
		upsertExtractedContact(db, accountID, selfEmail, addr.Name, addr.Email, ts)
	}
}

func ExtractFromSent(db *sql.DB, accountID string, to, cc []mailproto.EmailAddress) {
	if db == nil {
		return
	}
	var selfEmail string
	_ = db.QueryRow(`SELECT LOWER(email) FROM accounts WHERE id = ?`, accountID).Scan(&selfEmail)
	nowMs := time.Now().UnixMilli()
	for _, addr := range append(append([]mailproto.EmailAddress{}, to...), cc...) {
		upsertExtractedContact(db, accountID, selfEmail, addr.Name, addr.Email, nowMs)
	}
}

func upsertExtractedContact(db *sql.DB, accountID, selfEmail, rawName, rawEmail string, ts int64) {
	email := strings.ToLower(strings.TrimSpace(rawEmail))
	if email == "" || !strings.Contains(email, "@") || strings.EqualFold(email, selfEmail) || IsAutomatedAddress(email) {
		return
	}
	name := strings.TrimSpace(rawName)
	localPart := email[:strings.IndexByte(email, '@')]
	if name == "" {
		name = localPart
	}
	sum := sha256.Sum256([]byte(email))
	id := "cnt-" + hex.EncodeToString(sum[:8])
	nowMs := time.Now().UnixMilli()

	var existID, existName string
	var userEdited, mailCount int
	var lastAt int64
	err := db.QueryRow(`SELECT id, name, user_edited, mail_count, last_contact_at FROM contacts WHERE LOWER(email) = ?`, email).
		Scan(&existID, &existName, &userEdited, &mailCount, &lastAt)
	if err == sql.ErrNoRows {
		_, _ = db.Exec(`
			INSERT OR IGNORE INTO contacts (
				id, name, email, source_account_id, groups_json, is_vip, is_blocked,
				user_edited, mail_count, last_contact_at, updated_at
			) VALUES (?, ?, ?, ?, '[]', 0, 0, 0, 1, ?, ?)
		`, id, name, email, accountID, ts, nowMs)
		return
	}
	if err != nil {
		return
	}
	nextAt := lastAt
	if ts > nextAt {
		nextAt = ts
	}
	nextName := existName
	if userEdited == 0 && (existName == "" || strings.EqualFold(existName, localPart) || strings.EqualFold(existName, email)) &&
		name != "" && !strings.EqualFold(name, localPart) {
		nextName = name
	}
	_, _ = db.Exec(`UPDATE contacts SET name=?, mail_count=?, last_contact_at=?, updated_at=? WHERE id=?`,
		nextName, mailCount+1, nextAt, nowMs, existID)
}
