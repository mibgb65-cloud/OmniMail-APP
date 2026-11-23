package contacts

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

func ImportVCardContent(db *sql.DB, defaultAccountID, raw string) (VCardImportResult, error) {
	// 展开 RFC6350 折行（CRLF + 空格/Tab）
	unfolded := strings.ReplaceAll(strings.ReplaceAll(raw, "\r\n ", ""), "\n ", "")
	unfolded = strings.ReplaceAll(strings.ReplaceAll(unfolded, "\r\n\t", ""), "\n\t", "")
	lines := strings.Split(strings.ReplaceAll(unfolded, "\r\n", "\n"), "\n")

	var res VCardImportResult
	type vcardRec struct {
		fn, email, org, title, tel, note string
		cats                             []string
	}
	var cur *vcardRec

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		upper := strings.ToUpper(trimmed)
		if upper == "BEGIN:VCARD" {
			cur = &vcardRec{}
			continue
		}
		if upper == "END:VCARD" && cur != nil {
			imp, upd, skp := upsertVCardRecord(db, defaultAccountID, *cur)
			res.Imported += imp
			res.Updated += upd
			res.Skipped += skp
			cur = nil
			continue
		}
		if cur == nil {
			continue
		}
		colon := strings.IndexByte(trimmed, ':')
		if colon <= 0 {
			continue
		}
		prop, val := strings.ToUpper(trimmed[:colon]), strings.TrimSpace(trimmed[colon+1:])
		if semi := strings.IndexByte(prop, ';'); semi > 0 {
			prop = prop[:semi]
		}
		switch prop {
		case "FN":
			cur.fn = unescapeVCard(val)
		case "EMAIL":
			if cur.email == "" && strings.Contains(val, "@") {
				cur.email = strings.ToLower(val)
			}
		case "ORG":
			cur.org = strings.Trim(unescapeVCard(val), ";")
		case "TITLE":
			cur.title = unescapeVCard(val)
		case "TEL":
			if cur.tel == "" {
				cur.tel = val
			}
		case "NOTE":
			cur.note = unescapeVCard(val)
		case "CATEGORIES":
			for _, cat := range strings.Split(val, ",") {
				if c := strings.TrimSpace(cat); c != "" {
					cur.cats = append(cur.cats, c)
				}
			}
		}
	}
	return res, nil
}

func upsertVCardRecord(db *sql.DB, accID string, r struct {
	fn, email, org, title, tel, note string
	cats                             []string
}) (int, int, int) {
	if !strings.Contains(r.email, "@") {
		return 0, 0, 1
	}
	name := strings.TrimSpace(r.fn)
	if name == "" {
		name = r.email[:strings.IndexByte(r.email, '@')]
	}
	nowMs := time.Now().UnixMilli()
	var existID, existComp, existTitle, existPhone, existNote string
	err := db.QueryRow(`SELECT id, company, title, phone, note FROM contacts
		WHERE email=? OR id=(SELECT contact_id FROM contact_aliases WHERE email=?)`, r.email, r.email).
		Scan(&existID, &existComp, &existTitle, &existPhone, &existNote)
	if err == sql.ErrNoRows {
		sum := sha256.Sum256([]byte(r.email))
		id := "cnt-" + hex.EncodeToString(sum[:8])
		grpJ, _ := json.Marshal(r.cats)
		if r.cats == nil {
			grpJ = []byte("[]")
		}
		res, err := db.Exec(`
			INSERT INTO contacts(id, name, email, company, title, phone, note, source_account_id, groups_json, user_edited, updated_at)
			SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM contact_aliases WHERE email=?)
			ON CONFLICT(email) DO NOTHING
		`, id, name, r.email, r.org, r.title, r.tel, r.note, accID, string(grpJ), nowMs, r.email)
		if err != nil {
			return 0, 0, 1
		}
		if count, err := res.RowsAffected(); err != nil || count == 0 {
			return 0, 0, 1
		}
		return 1, 0, 0
	}
	if err != nil {
		return 0, 0, 1
	}
	// 仅补充空白字段，绝不覆盖用户已有备注
	nextComp, nextTitle, nextPhone, nextNote := existComp, existTitle, existPhone, existNote
	changed := false
	if nextComp == "" && r.org != "" {
		nextComp, changed = r.org, true
	}
	if nextTitle == "" && r.title != "" {
		nextTitle, changed = r.title, true
	}
	if nextPhone == "" && r.tel != "" {
		nextPhone, changed = r.tel, true
	}
	if nextNote == "" && r.note != "" {
		nextNote, changed = r.note, true
	}
	if !changed {
		return 0, 0, 1
	}
	_, _ = db.Exec(`UPDATE contacts SET company=?, title=?, phone=?, note=?, updated_at=? WHERE id=?`,
		nextComp, nextTitle, nextPhone, nextNote, nowMs, existID)
	return 0, 1, 0
}

func ExportVCardContent(db *sql.DB, contactIDs []string) (string, error) {
	all, err := ListContacts(db, ContactQuery{})
	if err != nil {
		return "", err
	}
	idFilter := make(map[string]bool, len(contactIDs))
	for _, id := range contactIDs {
		idFilter[id] = true
	}
	var sb strings.Builder
	for _, c := range all {
		if len(idFilter) > 0 && !idFilter[c.ID] {
			continue
		}
		sb.WriteString("BEGIN:VCARD\r\nVERSION:3.0\r\n")
		sb.WriteString(fmt.Sprintf("FN:%s\r\n", escapeVCard(c.Name)))
		sb.WriteString(fmt.Sprintf("EMAIL;TYPE=INTERNET:%s\r\n", c.Email))
		for _, email := range c.AlternateEmails {
			sb.WriteString(fmt.Sprintf("EMAIL;TYPE=INTERNET:%s\r\n", escapeVCard(email)))
		}
		if c.Company != "" {
			sb.WriteString(fmt.Sprintf("ORG:%s\r\n", escapeVCard(c.Company)))
		}
		if c.Title != "" {
			sb.WriteString(fmt.Sprintf("TITLE:%s\r\n", escapeVCard(c.Title)))
		}
		if c.Phone != "" {
			sb.WriteString(fmt.Sprintf("TEL;TYPE=CELL:%s\r\n", c.Phone))
		}
		if c.Note != "" {
			sb.WriteString(fmt.Sprintf("NOTE:%s\r\n", escapeVCard(c.Note)))
		}
		if len(c.Groups) > 0 {
			sb.WriteString(fmt.Sprintf("CATEGORIES:%s\r\n", strings.Join(c.Groups, ",")))
		}
		sb.WriteString("END:VCARD\r\n")
	}
	return sb.String(), nil
}

func unescapeVCard(s string) string {
	return strings.NewReplacer(`\n`, "\n", `\,`, ",", `\;`, ";", `\\`, `\`).Replace(s)
}

func escapeVCard(s string) string {
	return strings.NewReplacer(`\`, `\\`, "\n", `\n`, ",", `\,`, ";", `\;`).Replace(s)
}
