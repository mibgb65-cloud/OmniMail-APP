package search

import (
	"database/sql"
	"strings"

	"omnimail/internal/apperr"
)

// MatchMailIDs 只返回同时匹配本次同步和当前邮件视图的 ID，不读取邮件正文。
func MatchMailIDs(db *sql.DB, query MailSearchQuery, ids []string) ([]string, error) {
	result := []string{}
	if len(ids) == 0 {
		return result, nil
	}
	if len(ids) > 200 {
		return nil, apperr.New(apperr.CodeInvalidInput, "待匹配邮件数量过多")
	}
	where, args := buildMessageWhere(query)
	placeholders := make([]string, len(ids))
	for i, id := range ids {
		if id == "" || len(id) > 128 || strings.TrimSpace(id) != id {
			return nil, apperr.New(apperr.CodeInvalidInput, "邮件 ID 无效")
		}
		placeholders[i] = "?"
		args = append(args, id)
	}
	if where == "" {
		where = " WHERE "
	} else {
		where += " AND "
	}
	rows, err := db.Query("SELECT m.id FROM messages m"+where+"m.id IN ("+strings.Join(placeholders, ",")+")", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result = append(result, id)
	}
	return result, rows.Err()
}
