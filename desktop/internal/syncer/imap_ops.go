package syncer

import (
	"database/sql"
	"strings"
	"time"

	"omnimail/internal/mailproto"
)

func enqueueMessageOps(tx *sql.Tx, mailIDs []string, opType, targetFolder string) {
	nowMs := time.Now().UnixMilli()
	for _, mid := range mailIDs {
		var accID, mbID string
		var uid int64
		if tx.QueryRow(`SELECT account_id, remote_mailbox_id, remote_uid FROM messages WHERE id=?`, mid).Scan(&accID, &mbID, &uid) != nil {
			continue
		}
		if uid <= 0 || mbID == "" {
			continue
		}
		remoteName := mbID
		if idx := strings.IndexByte(mbID, ':'); idx >= 0 && idx < len(mbID)-1 {
			remoteName = mbID[idx+1:]
		}
		_, _ = tx.Exec(`INSERT INTO imap_op_queue(account_id, message_id, remote_mailbox, remote_uid, op_type, target_folder, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`, accID, mid, remoteName, uid, opType, targetFolder, nowMs)
	}
}

func refreshThreadsByMailIDs(tx *sql.Tx, mailIDs []string) {
	seen := make(map[string]bool)
	for _, mid := range mailIDs {
		var tid string
		if tx.QueryRow(`SELECT thread_id FROM messages WHERE id=?`, mid).Scan(&tid) == nil && tid != "" && !seen[tid] {
			seen[tid] = true
			_ = mailproto.RefreshThreadStats(tx, tid)
		}
	}
}

func MarkReadLocalAndQueue(db *sql.DB, mailIDs []string, isRead bool) ([]string, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	unreadVal := 1
	op := "mark_unread"
	if isRead {
		unreadVal = 0
		op = "mark_read"
	}
	accSet := make(map[string]bool)
	for _, id := range mailIDs {
		_, _ = tx.Exec(`UPDATE messages SET is_unread=? WHERE id=?`, unreadVal, id)
		var aid string
		if tx.QueryRow(`SELECT account_id FROM messages WHERE id=?`, id).Scan(&aid) == nil && aid != "" {
			accSet[aid] = true
		}
	}
	enqueueMessageOps(tx, mailIDs, op, "")
	refreshThreadsByMailIDs(tx, mailIDs)
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return mapKeys(accSet), nil
}

func ToggleStarLocalAndQueue(db *sql.DB, mailIDs []string, isStarred bool) ([]string, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	val := boolToInt(isStarred)
	op := "unstar"
	if isStarred {
		op = "star"
	}
	accSet := make(map[string]bool)
	for _, id := range mailIDs {
		_, _ = tx.Exec(`UPDATE messages SET is_starred=? WHERE id=?`, val, id)
		var aid string
		if tx.QueryRow(`SELECT account_id FROM messages WHERE id=?`, id).Scan(&aid) == nil && aid != "" {
			accSet[aid] = true
		}
	}
	enqueueMessageOps(tx, mailIDs, op, "")
	refreshThreadsByMailIDs(tx, mailIDs)
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return mapKeys(accSet), nil
}

func MoveFolderLocalAndQueue(db *sql.DB, mailIDs []string, targetFolder string) ([]string, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	accSet := make(map[string]bool)
	for _, id := range mailIDs {
		_, _ = tx.Exec(`UPDATE messages SET folder=?, snooze_until=0 WHERE id=?`, targetFolder, id)
		var aid string
		if tx.QueryRow(`SELECT account_id FROM messages WHERE id=?`, id).Scan(&aid) == nil && aid != "" {
			accSet[aid] = true
		}
	}
	enqueueMessageOps(tx, mailIDs, "move", targetFolder)
	refreshThreadsByMailIDs(tx, mailIDs)
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return mapKeys(accSet), nil
}

func SnoozeLocal(db *sql.DB, mailIDs []string, wakeUpUnixMs int64) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for _, id := range mailIDs {
		_, _ = tx.Exec(`UPDATE messages SET folder='snoozed', snooze_until=? WHERE id=?`, wakeUpUnixMs, id)
	}
	refreshThreadsByMailIDs(tx, mailIDs)
	return tx.Commit()
}

func DeletePermanentlyLocalAndQueue(db *sql.DB, mailIDs []string) ([]string, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	accSet := make(map[string]bool)
	tids := make(map[string]bool)
	enqueueMessageOps(tx, mailIDs, "delete_perm", "")
	for _, id := range mailIDs {
		var aid, tid string
		_ = tx.QueryRow(`SELECT account_id, thread_id FROM messages WHERE id=?`, id).Scan(&aid, &tid)
		if aid != "" {
			accSet[aid] = true
		}
		if tid != "" {
			tids[tid] = true
		}
		_, _ = tx.Exec(`DELETE FROM messages_fts WHERE message_id=?`, id)
		_, _ = tx.Exec(`DELETE FROM messages WHERE id=?`, id)
	}
	for tid := range tids {
		_ = mailproto.RefreshThreadStats(tx, tid)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return mapKeys(accSet), nil
}

func mapKeys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func wakeDueSnoozed(db *sql.DB) []string {
	nowMs := time.Now().UnixMilli()
	rows, err := db.Query(`SELECT id, thread_id FROM messages WHERE folder='snoozed' AND snooze_until > 0 AND snooze_until <= ?`, nowMs)
	if err != nil {
		return nil
	}
	var ids, tids []string
	for rows.Next() {
		var id, tid string
		if rows.Scan(&id, &tid) == nil {
			ids = append(ids, id)
			tids = append(tids, tid)
		}
	}
	_ = rows.Close()
	if len(ids) == 0 {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return nil
	}
	for _, id := range ids {
		_, _ = tx.Exec(`UPDATE messages SET folder='inbox', is_unread=1, snooze_until=0 WHERE id=?`, id)
	}
	for _, tid := range tids {
		_ = mailproto.RefreshThreadStats(tx, tid)
	}
	_ = tx.Commit()
	return ids
}
