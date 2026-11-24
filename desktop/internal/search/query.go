package search

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
)

func GetFolderCounts(db *sql.DB, accountID string) (FolderCounts, error) {
	out := FolderCounts{Counts: make(map[string]int), Totals: make(map[string]int)}
	accID := strings.TrimSpace(accountID)
	accFilter, args := "", []any(nil)
	if accID != "" {
		accFilter, args = " WHERE account_id = ?", []any{accID}
	}
	rows, err := db.Query(`SELECT folder, COUNT(1) AS total, SUM(CASE WHEN is_unread = 1 THEN 1 ELSE 0 END) AS unread FROM messages`+accFilter+` GROUP BY folder`, args...)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var f string
		var tot, unr int
		if rows.Scan(&f, &tot, &unr) == nil {
			out.Totals[f] = tot
			if f == "drafts" || f == "outbox" || f == "scheduled" || f == "snoozed" {
				out.Counts[f] = tot
			} else {
				out.Counts[f] = unr
			}
		}
	}
	_ = rows.Close()

	starSQL := `SELECT COUNT(1) FROM messages WHERE is_starred = 1 AND folder NOT IN ('trash', 'spam')`
	if accID != "" {
		starSQL += ` AND account_id = ?`
	}
	var starred int
	_ = db.QueryRow(starSQL, args...).Scan(&starred)
	out.Counts["starred"], out.Totals["starred"] = starred, starred

	var localDrafts int
	_ = db.QueryRow(`SELECT COUNT(1) FROM drafts`+accFilter, args...).Scan(&localDrafts)
	if localDrafts > out.Counts["drafts"] {
		out.Counts["drafts"] = localDrafts
	}
	return out, nil
}

func buildMessageWhere(q MailSearchQuery) (string, []any) {
	parsed := ParseKeywordOperators(q.Keyword)
	ftsExpr, shortTerms := SplitTermsForFTS(parsed.FreeTerms)

	var wheres []string
	var args []any

	if len(q.AccountIDs) > 0 {
		ph := make([]string, len(q.AccountIDs))
		for i, id := range q.AccountIDs {
			ph[i] = "?"
			args = append(args, id)
		}
		wheres = append(wheres, "m.account_id IN ("+strings.Join(ph, ",")+")")
	}

	effFolder := strings.TrimSpace(q.Folder)
	if parsed.Folder != "" {
		effFolder = parsed.Folder
	}
	hasSearch := strings.TrimSpace(q.Keyword) != "" || q.From != "" || q.To != "" || q.DateFrom > 0 || q.DateTo > 0 || len(q.LabelIDs) > 0
	if effFolder == "starred" || parsed.OnlyStarred || q.Tab == "starred" {
		wheres = append(wheres, "m.is_starred = 1 AND m.folder NOT IN ('trash','spam')")
	} else if effFolder != "" && effFolder != "all" && !hasSearch {
		wheres = append(wheres, "m.folder = ?")
		args = append(args, effFolder)
	} else if effFolder != "" && effFolder != "all" && q.Folder != "inbox" {
		wheres = append(wheres, "m.folder = ?")
		args = append(args, effFolder)
	} else if !hasSearch {
		wheres = append(wheres, "m.folder = 'inbox'")
	}

	if q.Tab == "unread" || parsed.OnlyUnread {
		wheres = append(wheres, "m.is_unread = 1")
	}
	if q.Tab == "attachments" || (q.HasAttachment != nil && *q.HasAttachment) || (parsed.HasAttachment != nil && *parsed.HasAttachment) {
		wheres = append(wheres, "m.has_attachments = 1")
	}
	fromVal := firstNonEmptyStr(q.From, parsed.From)
	if fromVal != "" {
		like := "%" + fromVal + "%"
		wheres = append(wheres, "(m.sender_email LIKE ? OR m.sender_name LIKE ?)")
		args = append(args, like, like)
	}
	toVal := firstNonEmptyStr(q.To, parsed.To)
	if toVal != "" {
		like := "%" + toVal + "%"
		wheres = append(wheres, "(m.to_json LIKE ? OR m.cc_json LIKE ?)")
		args = append(args, like, like)
	}
	if q.DateFrom > 0 {
		wheres = append(wheres, "m.received_at >= ?")
		args = append(args, q.DateFrom)
	}
	if q.DateTo > 0 {
		wheres = append(wheres, "m.received_at <= ?")
		args = append(args, q.DateTo)
	}
	if len(q.LabelIDs) > 0 {
		ph := make([]string, len(q.LabelIDs))
		for i, lid := range q.LabelIDs {
			ph[i] = "?"
			args = append(args, lid)
		}
		wheres = append(wheres, "EXISTS (SELECT 1 FROM message_labels ml WHERE ml.message_id = m.id AND ml.label_id IN ("+strings.Join(ph, ",")+"))")
	}
	if ftsExpr != "" {
		wheres = append(wheres, "m.id IN (SELECT message_id FROM messages_fts WHERE messages_fts MATCH ?)")
		args = append(args, ftsExpr)
	}
	for _, st := range shortTerms {
		like := "%" + st + "%"
		wheres = append(wheres, "(m.subject LIKE ? OR m.sender_name LIKE ? OR m.sender_email LIKE ? OR m.body_text LIKE ?)")
		args = append(args, like, like, like, like)
	}

	whereSQL := ""
	if len(wheres) > 0 {
		whereSQL = " WHERE " + strings.Join(wheres, " AND ")
	}
	return whereSQL, args
}

func ListMessages(db *sql.DB, q MailSearchQuery, blockRemoteImages bool) (MessageListPage, error) {
	whereSQL, args := buildMessageWhere(q)
	var total int
	_ = db.QueryRow("SELECT COUNT(1) FROM messages m"+whereSQL, args...).Scan(&total)

	if parts := strings.SplitN(strings.TrimSpace(q.Cursor), ":", 2); len(parts) == 2 {
		if curTs, err := strconv.ParseInt(parts[0], 10, 64); err == nil {
			curClause := "(m.received_at < ? OR (m.received_at = ? AND m.id < ?))"
			if whereSQL == "" {
				whereSQL = " WHERE " + curClause
			} else {
				whereSQL += " AND " + curClause
			}
			args = append(args, curTs, curTs, parts[1])
		}
	}

	limit := q.Limit
	if limit <= 0 {
		limit = 50
	} else if limit > 200 {
		limit = 200
	}
	rows, err := db.Query(`SELECT m.id, m.received_at FROM messages m`+whereSQL+` ORDER BY m.received_at DESC, m.id DESC LIMIT ?`, append(args, limit+1)...)
	if err != nil {
		return MessageListPage{}, err
	}
	var ids []string
	var lastTs int64
	var lastID string
	for rows.Next() {
		var id string
		var ts int64
		if rows.Scan(&id, &ts) == nil {
			ids = append(ids, id)
			if len(ids) <= limit {
				lastTs, lastID = ts, id
			}
		}
	}
	_ = rows.Close()

	nextCursor := ""
	if len(ids) > limit {
		ids = ids[:limit]
		nextCursor = fmt.Sprintf("%d:%s", lastTs, lastID)
	}
	items := make([]MailItemDTO, 0, len(ids))
	for _, id := range ids {
		if item, err := GetMessageItem(db, id, false, blockRemoteImages); err == nil {
			items = append(items, item)
		}
	}
	remote := computePageRemoteMore(db, q)
	return MessageListPage{
		Items: items, NextCursor: nextCursor, TotalCount: total,
		HasRemoteMore: remote.HasRemoteMore, RemoteTotalCount: remote.RemoteTotalCount,
	}, nil
}

func firstNonEmptyStr(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return strings.TrimSpace(a)
	}
	return strings.TrimSpace(b)
}
