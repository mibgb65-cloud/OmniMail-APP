package syncer

import (
	"context"
	"database/sql"
	"strings"
	"sync"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/search"
)

func saveBackfillProgress(
	db *sql.DB,
	mbID string,
	oldestUID, lastUID, remoteTotal uint32,
	exhausted bool,
) {
	exInt := 0
	if exhausted || (oldestUID == 1 && remoteTotal > 0) || remoteTotal == 0 {
		exInt = 1
	}
	_, _ = db.Exec(
		`UPDATE remote_mailboxes
		 SET oldest_uid = CASE WHEN ? > 0 AND (oldest_uid = 0 OR ? < oldest_uid) THEN ? ELSE oldest_uid END,
		     last_uid = CASE WHEN ? > last_uid THEN ? ELSE last_uid END,
		     history_exhausted = CASE WHEN ? = 1 THEN 1 ELSE history_exhausted END,
		     total_count = ?,
		     updated_at = ?
		 WHERE id = ?`,
		oldestUID, oldestUID, oldestUID,
		lastUID, lastUID,
		exInt,
		remoteTotal,
		time.Now().UnixMilli(),
		mbID,
	)
}

func (m *Manager) lockBackfill(accountID, folder string) func() {
	key := strings.TrimSpace(accountID) + ":" + folder
	m.mu.Lock()
	if m.backfillLocks == nil {
		m.backfillLocks = make(map[string]*sync.Mutex)
	}
	mu, ok := m.backfillLocks[key]
	if !ok {
		mu = &sync.Mutex{}
		m.backfillLocks[key] = mu
	}
	m.mu.Unlock()
	mu.Lock()
	return mu.Unlock
}

func listBackfillMailboxes(db *sql.DB, accountID, folder string) ([]backfillMailboxRow, error) {
	query := `
		SELECT rm.id, rm.account_id, rm.remote_name, rm.local_folder,
		       rm.uid_validity, rm.oldest_uid, rm.last_uid, rm.total_count
		FROM remote_mailboxes rm
		WHERE rm.local_folder = ? AND rm.history_exhausted = 0`
	args := []any{folder}
	if accountID != "" {
		query += ` AND rm.account_id = ?`
		args = append(args, accountID)
	}
	query += `
		ORDER BY COALESCE((SELECT MIN(m.received_at) FROM messages m WHERE m.remote_mailbox_id = rm.id), 0) DESC,
		         rm.total_count DESC`

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []backfillMailboxRow
	for rows.Next() {
		var r backfillMailboxRow
		if err := rows.Scan(
			&r.ID, &r.AccountID, &r.RemoteName, &r.LocalFolder,
			&r.UIDValidity, &r.OldestUID, &r.LastUID, &r.TotalCount,
		); err == nil {
			out = append(out, r)
		}
	}
	return out, rows.Err()
}

// LoadOlderMessages 按需向远端 IMAP 服务器回溯拉取早于本地 oldest_uid 的历史邮件并入库。
func (m *Manager) LoadOlderMessages(
	ctx context.Context,
	accountID string,
	folder string,
	limit int,
) (LoadOlderResult, error) {
	effFolder := normalizeBackfillFolder(folder)
	accID := strings.TrimSpace(accountID)
	if !isBackfillableFolder(effFolder) {
		return LoadOlderResult{HasRemoteMore: false}, nil
	}
	limit = normalizeBackfillLimit(limit)

	m.mu.Lock()
	sess := m.sess
	tm := m.tm
	hooks := m.hooks
	m.mu.Unlock()
	if sess == nil {
		return LoadOlderResult{}, apperr.New(apperr.CodeInternal, "当前工作空间尚未就绪")
	}

	unlock := m.lockBackfill(accID, effFolder)
	defer unlock()

	if ctx == nil {
		ctx = context.Background()
	}
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 45*time.Second)
		defer cancel()
	}
	runCtx, stopWatch := context.WithCancel(ctx)
	defer stopWatch()
	go func() {
		select {
		case <-sess.Ctx.Done():
			stopWatch()
		case <-runCtx.Done():
		}
	}()

	candidates, err := listBackfillMailboxes(sess.DB, accID, effFolder)
	if err != nil {
		return LoadOlderResult{}, err
	}

	remaining := limit
	totalFetched := 0
	var firstErr error
	for _, mb := range candidates {
		if remaining <= 0 {
			break
		}
		if err := runCtx.Err(); err != nil {
			firstErr = err
			break
		}
		n, err := backfillSingleMailboxIMAP(runCtx, sess, tm, hooks, mb, remaining)
		totalFetched += n
		if n > 0 {
			remaining -= n
		}
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}

	var accFilter []string
	if accID != "" {
		accFilter = []string{accID}
	}
	st := search.ComputeRemoteMoreForFolder(sess.DB, accFilter, effFolder)
	res := LoadOlderResult{
		FetchedCount:  totalFetched,
		HasRemoteMore: st.HasRemoteMore,
		RemoteTotal:   st.RemoteTotalCount,
		LocalSynced:   st.LocalSyncedCount,
	}
	if totalFetched > 0 {
		m.notifyTrayUnread()
		return res, nil
	}
	return res, firstErr
}
