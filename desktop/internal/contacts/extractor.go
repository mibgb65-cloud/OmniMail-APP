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
	if email == "" || !strings.Contains(email, "@") || strings.EqualFold(email, selfEmail) {
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

	// 备用邮箱更新归属联系人，只为非自动发件的新地址创建独立联系人。
	res, err := db.Exec(`UPDATE contacts SET
		name=CASE WHEN user_edited=0 AND (name='' OR LOWER(name)=? OR LOWER(name)=?) AND LOWER(?)<>?
			THEN ? ELSE name END,
		mail_count=mail_count+1, last_contact_at=MAX(last_contact_at, ?), updated_at=?
		WHERE id IN (SELECT id FROM contacts WHERE email=? UNION SELECT contact_id FROM contact_aliases WHERE email=?)`,
		localPart, email, name, localPart, name, ts, nowMs, email, email)
	if err != nil {
		return
	}
	if updated, _ := res.RowsAffected(); updated != 0 || IsAutomatedAddress(email) {
		return
	}
	_, _ = db.Exec(`INSERT INTO contacts(id, name, email, source_account_id, mail_count, last_contact_at, updated_at)
		SELECT ?, ?, ?, ?, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM contact_aliases WHERE email=?)
		ON CONFLICT(email) DO UPDATE SET mail_count=mail_count+1, last_contact_at=MAX(last_contact_at, excluded.last_contact_at)`,
		id, name, email, accountID, ts, nowMs, email)
}
