package mailrepair

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"omnimail/internal/mailproto"
)

func hasDirtyAddrJSON(raw string) bool {
	if raw == "" || raw == "[]" {
		return false
	}
	if hasGarbledText(raw) {
		return true
	}
	var list []mailproto.EmailAddress
	if json.Unmarshal([]byte(raw), &list) != nil {
		return true
	}
	for _, a := range list {
		if hasDirtyEmail(a.Email) || strings.ContainsAny(a.Name, "<>") {
			return true
		}
	}
	return false
}

func marshalOrRepairAddrJSON(parsed []mailproto.EmailAddress, oldJSON, hint string) string {
	if len(parsed) > 0 {
		b, _ := json.Marshal(parsed)
		return string(b)
	}
	var old []mailproto.EmailAddress
	if json.Unmarshal([]byte(oldJSON), &old) != nil || len(old) == 0 {
		return "[]"
	}
	var fixed []mailproto.EmailAddress
	for _, item := range old {
		if list := mailproto.ParseAddressHeader(item.Name+" <"+item.Email+">", hint); len(list) > 0 {
			fixed = append(fixed, list...)
		} else if list := mailproto.ParseAddressHeader(item.Email, hint); len(list) > 0 {
			fixed = append(fixed, list...)
		}
	}
	if len(fixed) == 0 {
		return oldJSON
	}
	b, _ := json.Marshal(fixed)
	return string(b)
}

func loadAttachmentMeta(db *sql.DB, msgID string) (exts, names []string) {
	rows, err := db.Query(`SELECT ext, filename FROM attachments WHERE message_id = ?`, msgID)
	if err != nil {
		return nil, nil
	}
	defer rows.Close()
	for rows.Next() {
		var ext, fn string
		if rows.Scan(&ext, &fn) == nil {
			exts = append(exts, ext)
			names = append(names, fn)
		}
	}
	return exts, names
}

func repairMalformedContacts(db *sql.DB) error {
	type contactRow struct {
		id, name, email     string
		userEdited, mailCnt int
		lastContactAt       int64
	}
	rows, err := db.Query(`SELECT id, name, email, user_edited, mail_count, last_contact_at FROM contacts`)
	if err != nil {
		return err
	}
	var dirty []contactRow
	for rows.Next() {
		var c contactRow
		if rows.Scan(&c.id, &c.name, &c.email, &c.userEdited, &c.mailCnt, &c.lastContactAt) == nil {
			if hasDirtyEmail(c.email) || hasGarbledText(c.name) || strings.ContainsAny(c.name, "<>") {
				dirty = append(dirty, c)
			}
		}
	}
	rows.Close()

	nowMs := time.Now().UnixMilli()
	for _, c := range dirty {
		parsed := mailproto.ParseAddressHeader(c.name, "")
		if len(parsed) == 0 || parsed[0].Email == "" {
			parsed = mailproto.ParseAddressHeader(c.email, "")
		}
		if len(parsed) == 0 || parsed[0].Email == "" {
			parsed = mailproto.ParseAddressHeader(c.name+" "+c.email, "")
		}
		if len(parsed) == 0 || parsed[0].Email == "" {
			if c.userEdited == 0 {
				_, _ = db.Exec(`DELETE FROM contacts WHERE id = ?`, c.id)
			}
			continue
		}
		cleanEmail, cleanName := parsed[0].Email, parsed[0].Name
		if hasGarbledText(cleanName) {
			var msgSender string
			_ = db.QueryRow(`SELECT sender_name FROM messages WHERE LOWER(sender_email) = ? AND sender_name != '' ORDER BY received_at DESC LIMIT 1`, cleanEmail).Scan(&msgSender)
			if msgSender != "" && !hasGarbledText(msgSender) {
				cleanName = msgSender
			} else if at := strings.IndexByte(cleanEmail, '@'); at > 0 {
				cleanName = cleanEmail[:at]
			}
		}
		if c.userEdited != 0 && !hasGarbledText(c.name) && !strings.ContainsAny(c.name, "<>") {
			cleanName = c.name
		}
		var existingID string
		if db.QueryRow(`SELECT id FROM contacts WHERE LOWER(email) = ? AND id != ? LIMIT 1`, cleanEmail, c.id).Scan(&existingID) == nil && existingID != "" {
			_, _ = db.Exec(`UPDATE contacts SET
				mail_count = mail_count + ?,
				last_contact_at = CASE WHEN ? > last_contact_at THEN ? ELSE last_contact_at END,
				name = CASE WHEN user_edited = 0 AND (name = '' OR INSTR(name, '<') > 0) AND ? != '' THEN ? ELSE name END,
				updated_at = ?
				WHERE id = ?`, c.mailCnt, c.lastContactAt, c.lastContactAt, cleanName, cleanName, nowMs, existingID)
			_, _ = db.Exec(`UPDATE OR IGNORE contact_aliases SET contact_id = ? WHERE contact_id = ?`, existingID, c.id)
			_, _ = db.Exec(`DELETE FROM contacts WHERE id = ?`, c.id)
			continue
		}
		_, _ = db.Exec(`UPDATE contacts SET name = ?, email = ?, updated_at = ? WHERE id = ?`, cleanName, cleanEmail, nowMs, c.id)
	}
	return nil
}
