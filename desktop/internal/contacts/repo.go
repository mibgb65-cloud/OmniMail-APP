package contacts

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

func ListContacts(db *sql.DB, q ContactQuery) ([]ContactItemDTO, error) {
	where := []string{"1=1"}
	var args []any
	kw := strings.TrimSpace(q.Keyword)
	if kw != "" {
		pat := "%" + kw + "%"
		where = append(where, "(c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ? OR c.note LIKE ?)")
		args = append(args, pat, pat, pat, pat)
	}
	if q.VIPOnly {
		where = append(where, "c.is_vip = 1")
	}

	rows, err := db.Query(`
		SELECT c.id, c.name, c.email, c.company, c.title, c.phone, c.note,
		       c.source_account_id, COALESCE(a.short_tag, '通讯录'),
		       c.groups_json, c.is_vip, c.is_blocked, c.mail_count, c.last_contact_at
		FROM contacts c
		LEFT JOIN accounts a ON a.id = c.source_account_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY c.is_vip DESC, c.mail_count DESC, c.last_contact_at DESC, c.name ASC
		LIMIT 500
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	grpFilter := strings.TrimSpace(q.Group)
	out := make([]ContactItemDTO, 0)
	for rows.Next() {
		item, ok := scanContactRow(rows)
		if !ok {
			continue
		}
		if grpFilter != "" && grpFilter != "all" && !containsStr(item.Groups, grpFilter) {
			continue
		}
		out = append(out, item)
	}
	return out, nil
}

func SuggestRecipients(db *sql.DB, prefix string) ([]ContactItemDTO, error) {
	p := strings.TrimSpace(prefix)
	pat := "%" + p + "%"
	rows, err := db.Query(`
		SELECT c.id, c.name, c.email, c.company, c.title, c.phone, c.note,
		       c.source_account_id, COALESCE(a.short_tag, '通讯录'),
		       c.groups_json, c.is_vip, c.is_blocked, c.mail_count, c.last_contact_at
		FROM contacts c
		LEFT JOIN accounts a ON a.id = c.source_account_id
		WHERE c.is_blocked = 0 AND (? = '' OR c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)
		ORDER BY c.is_vip DESC, c.mail_count DESC, c.last_contact_at DESC
		LIMIT 10
	`, p, pat, pat, pat)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ContactItemDTO, 0, 10)
	for rows.Next() {
		if item, ok := scanContactRow(rows); ok {
			out = append(out, item)
		}
	}
	return out, nil
}

func SaveContact(db *sql.DB, in ContactItemDTO) (ContactItemDTO, error) {
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if !strings.Contains(email, "@") {
		return ContactItemDTO{}, apperr.New(apperr.CodeInvalidInput, "请输入有效的联系人邮箱地址")
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = email[:strings.IndexByte(email, '@')]
	}
	id := strings.TrimSpace(in.ID)
	if id == "" {
		_ = db.QueryRow(`SELECT id FROM contacts WHERE LOWER(email) = ?`, email).Scan(&id)
	}
	if id == "" {
		b := make([]byte, 5)
		_, _ = rand.Read(b)
		id = fmt.Sprintf("cnt-%d-%s", time.Now().UnixMilli(), hex.EncodeToString(b))
	}
	if in.Groups == nil {
		in.Groups = []string{}
	}
	grpJ, _ := json.Marshal(in.Groups)
	vipInt, blkInt := 0, 0
	if in.VIP {
		vipInt = 1
	}
	if in.Blocked {
		blkInt = 1
	}
	nowMs := time.Now().UnixMilli()
	_, err := db.Exec(`
		INSERT INTO contacts (
			id, name, email, company, title, phone, note, source_account_id,
			groups_json, is_vip, is_blocked, user_edited, mail_count, last_contact_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, email=excluded.email, company=excluded.company, title=excluded.title,
			phone=excluded.phone, note=excluded.note, groups_json=excluded.groups_json,
			is_vip=excluded.is_vip, is_blocked=excluded.is_blocked, user_edited=1, updated_at=excluded.updated_at
	`, id, name, email, in.Company, in.Title, in.Phone, in.Note, in.SourceAccountID,
		string(grpJ), vipInt, blkInt, in.MailCount, nowMs, nowMs)
	if err != nil {
		return ContactItemDTO{}, err
	}
	list, _ := ListContacts(db, ContactQuery{Keyword: email})
	for _, c := range list {
		if c.ID == id || strings.EqualFold(c.Email, email) {
			return c, nil
		}
	}
	in.ID = id
	in.Name = name
	in.Email = email
	in.AvatarText, in.AvatarTone = deriveAvatar(name, email)
	return in, nil
}

func DeleteContact(db *sql.DB, id string) error {
	_, err := db.Exec(`DELETE FROM contacts WHERE id = ?`, strings.TrimSpace(id))
	return err
}

func scanContactRow(rows *sql.Rows) (ContactItemDTO, bool) {
	var c ContactItemDTO
	var grpJ string
	var vipInt, blkInt int
	if err := rows.Scan(
		&c.ID, &c.Name, &c.Email, &c.Company, &c.Title, &c.Phone, &c.Note,
		&c.SourceAccountID, &c.SourceTag, &grpJ, &vipInt, &blkInt, &c.MailCount, &c.LastContactAt,
	); err != nil {
		return ContactItemDTO{}, false
	}
	_ = json.Unmarshal([]byte(grpJ), &c.Groups)
	if c.Groups == nil {
		c.Groups = []string{}
	}
	c.VIP = vipInt != 0
	c.Blocked = blkInt != 0
	c.AvatarText, c.AvatarTone = deriveAvatar(c.Name, c.Email)
	c.LastContactText = formatContactTime(c.LastContactAt)
	return c, true
}

func containsStr(list []string, target string) bool {
	for _, x := range list {
		if strings.EqualFold(x, target) {
			return true
		}
	}
	return false
}
