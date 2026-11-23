package search

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
)

func queryMessageLabels(db *sql.DB, msgID string) []string {
	rows, err := db.Query(`SELECT label_id FROM message_labels WHERE message_id = ?`, msgID)
	if err != nil {
		return []string{}
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var lid string
		if rows.Scan(&lid) == nil {
			out = append(out, lid)
		}
	}
	return out
}

func ListLabels(db *sql.DB) ([]MailLabelDTO, error) {
	rows, err := db.Query(`SELECT id, name, color FROM labels ORDER BY rowid ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]MailLabelDTO, 0)
	for rows.Next() {
		var l MailLabelDTO
		if rows.Scan(&l.ID, &l.Name, &l.Color) == nil {
			out = append(out, l)
		}
	}
	return out, nil
}

func SaveLabel(db *sql.DB, in MailLabelDTO) (MailLabelDTO, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" || len([]rune(name)) > 30 {
		return MailLabelDTO{}, apperr.New(apperr.CodeInvalidInput, "标签名称长度须为 1~30 字符")
	}
	color := strings.TrimSpace(in.Color)
	if color == "" {
		color = "#2563EB"
	}
	id := strings.TrimSpace(in.ID)
	if id == "" {
		id = fmt.Sprintf("lbl-%d", time.Now().UnixMilli()%1_000_000_000)
	}
	_, err := db.Exec(`INSERT INTO labels(id, name, color) VALUES (?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color`, id, name, color)
	if err != nil {
		return MailLabelDTO{}, err
	}
	return MailLabelDTO{ID: id, Name: name, Color: color}, nil
}

func DeleteLabel(db *sql.DB, id string) error {
	_, err := db.Exec(`DELETE FROM labels WHERE id = ?`, strings.TrimSpace(id))
	return err
}

func ApplyLabels(db *sql.DB, mailIDs, addIDs, removeIDs []string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for _, mid := range mailIDs {
		for _, rid := range removeIDs {
			_, _ = tx.Exec(`DELETE FROM message_labels WHERE message_id=? AND label_id=?`, mid, rid)
		}
		for _, aid := range addIDs {
			_, _ = tx.Exec(`INSERT OR IGNORE INTO message_labels(message_id, label_id) VALUES (?, ?)`, mid, aid)
		}
	}
	return tx.Commit()
}

func pickAvatarChar(name, email string) string {
	for _, src := range []string{strings.TrimSpace(name), strings.TrimSpace(email)} {
		if src != "" {
			return strings.ToUpper(string([]rune(src)[:1]))
		}
	}
	return "M"
}

func hashStr(s string) uint32 {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

func formatAddrJSON(raw string) string {
	var addrs []mailproto.EmailAddress
	if json.Unmarshal([]byte(raw), &addrs) != nil || len(addrs) == 0 {
		return ""
	}
	parts := make([]string, 0, len(addrs))
	for _, a := range addrs {
		if a.Name != "" && a.Email != "" && a.Name != a.Email {
			parts = append(parts, fmt.Sprintf("%s <%s>", a.Name, a.Email))
		} else if a.Email != "" {
			parts = append(parts, a.Email)
		} else if a.Name != "" {
			parts = append(parts, a.Name)
		}
	}
	return strings.Join(parts, ", ")
}

func formatMailTimes(unixMs int64) (short string, full string) {
	if unixMs <= 0 {
		return "", ""
	}
	t := time.UnixMilli(unixMs)
	now := time.Now()
	full = t.Format("2006-01-02 15:04")
	if t.Year() == now.Year() && t.YearDay() == now.YearDay() {
		return t.Format("15:04"), full
	}
	if t.Year() == now.Year() {
		return t.Format("01-02"), full
	}
	return t.Format("2006/01"), full
}

func splitParagraphs(txt string) []string {
	norm := strings.ReplaceAll(strings.TrimSpace(txt), "\r\n", "\n")
	if norm == "" {
		return []string{"（此邮件无正文内容）"}
	}
	rawLines := strings.Split(norm, "\n")
	out := make([]string, 0, len(rawLines))
	for _, l := range rawLines {
		trimmed := strings.TrimSpace(l)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	if len(out) == 0 {
		return []string{norm}
	}
	return out
}
