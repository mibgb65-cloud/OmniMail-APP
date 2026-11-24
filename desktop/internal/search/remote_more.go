package search

import (
	"database/sql"
	"strings"
)

// RemoteBackfillState 描述当前文件夹在远端 IMAP 服务器的剩余历史邮件统计。
type RemoteBackfillState struct {
	HasRemoteMore    bool
	RemoteTotalCount int
	LocalSyncedCount int
}

// IsRemoteFolder 判断文件夹是否对应远端 IMAP 邮箱，可支持向历史回溯。
func IsRemoteFolder(folder string) bool {
	switch strings.ToLower(strings.TrimSpace(folder)) {
	case "inbox", "sent", "drafts", "archive", "spam", "trash":
		return true
	default:
		return false
	}
}

// ComputeRemoteMoreForFolder 汇总指定账号范围与文件夹下远端邮箱的历史余量。
func ComputeRemoteMoreForFolder(db *sql.DB, accountIDs []string, folder string) RemoteBackfillState {
	eff := strings.ToLower(strings.TrimSpace(folder))
	if eff == "" {
		eff = "inbox"
	}
	if !IsRemoteFolder(eff) {
		return RemoteBackfillState{}
	}

	query := `
		SELECT rm.total_count, rm.oldest_uid, rm.history_exhausted,
		       (SELECT COUNT(1) FROM messages m WHERE m.remote_mailbox_id = rm.id) AS local_cnt
		FROM remote_mailboxes rm
		WHERE rm.local_folder = ?`
	args := []any{eff}
	if len(accountIDs) > 0 {
		ph := make([]string, len(accountIDs))
		for i, id := range accountIDs {
			ph[i] = "?"
			args = append(args, id)
		}
		query += ` AND rm.account_id IN (` + strings.Join(ph, ",") + `)`
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return RemoteBackfillState{}
	}
	defer rows.Close()

	var st RemoteBackfillState
	for rows.Next() {
		var total, oldest, exhausted, localCnt int
		if rows.Scan(&total, &oldest, &exhausted, &localCnt) != nil {
			continue
		}
		st.RemoteTotalCount += total
		st.LocalSyncedCount += localCnt
		if exhausted == 0 && total > 0 && (oldest > 1 || total > localCnt) {
			st.HasRemoteMore = true
		}
	}
	return st
}

func computePageRemoteMore(db *sql.DB, q MailSearchQuery) RemoteBackfillState {
	hasSearch := strings.TrimSpace(q.Keyword) != "" ||
		strings.TrimSpace(q.From) != "" ||
		strings.TrimSpace(q.To) != "" ||
		q.DateFrom > 0 ||
		q.DateTo > 0 ||
		len(q.LabelIDs) > 0
	if hasSearch {
		return RemoteBackfillState{}
	}
	eff := strings.ToLower(strings.TrimSpace(q.Folder))
	if eff == "" {
		eff = "inbox"
	}
	if eff == "starred" || eff == "all" || strings.EqualFold(strings.TrimSpace(q.Tab), "starred") {
		return RemoteBackfillState{}
	}
	return ComputeRemoteMoreForFolder(db, q.AccountIDs, eff)
}
