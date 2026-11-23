package contacts

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

type ContactMailSummary struct {
	ID       string `json:"id"`
	Subject  string `json:"subject"`
	TimeText string `json:"timeText"`
}

type ContactMailPage struct {
	Items      []ContactMailSummary `json:"items"`
	NextCursor string               `json:"nextCursor"`
}

func ListContactMailHistory(db *sql.DB, id, cursor string) (ContactMailPage, error) {
	if !validContactID(id) {
		return ContactMailPage{}, apperr.New(apperr.CodeInvalidInput, "联系人标识无效")
	}
	var page ContactMailPage
	var clause string
	args := []any{id, id}
	if cursor != "" {
		stamp, mailID, ok := strings.Cut(cursor, ":")
		ts, err := strconv.ParseInt(stamp, 10, 64)
		if !ok || err != nil || !validContactID(mailID) {
			return page, apperr.New(apperr.CodeInvalidInput, "历史邮件分页位置无效")
		}
		clause = " AND (m.received_at, m.id) < (?, ?)"
		args = append(args, ts, mailID)
	}
	// 使用实际参与者精确匹配，不用正文全文搜索；同一封邮件匹配多个地址也只列一次。
	rows, err := db.Query(`
		WITH addresses(email) AS (
			SELECT LOWER(email) FROM contacts WHERE id=?
			UNION SELECT LOWER(email) FROM contact_aliases WHERE contact_id=?
		)
		SELECT m.id, m.subject, m.received_at FROM messages m
		WHERE (LOWER(m.sender_email) IN (SELECT email FROM addresses)
			OR EXISTS (SELECT 1 FROM json_each(m.to_json) j WHERE LOWER(json_extract(j.value, '$.email')) IN (SELECT email FROM addresses))
			OR EXISTS (SELECT 1 FROM json_each(m.cc_json) j WHERE LOWER(json_extract(j.value, '$.email')) IN (SELECT email FROM addresses))
			OR EXISTS (SELECT 1 FROM json_each(m.bcc_json) j WHERE LOWER(json_extract(j.value, '$.email')) IN (SELECT email FROM addresses)))`+
		clause+` ORDER BY m.received_at DESC, m.id DESC LIMIT 16`, args...)
	if err != nil {
		return page, err
	}
	defer rows.Close()
	page.Items = []ContactMailSummary{}
	var lastCursor string
	for rows.Next() {
		var item ContactMailSummary
		var ts int64
		if err := rows.Scan(&item.ID, &item.Subject, &ts); err != nil {
			return ContactMailPage{}, err
		}
		if len(page.Items) == 15 {
			page.NextCursor = lastCursor
			break
		}
		item.TimeText = time.UnixMilli(ts).Format("01-02 15:04")
		page.Items = append(page.Items, item)
		lastCursor = fmt.Sprintf("%d:%s", ts, item.ID)
	}
	return page, rows.Err()
}
