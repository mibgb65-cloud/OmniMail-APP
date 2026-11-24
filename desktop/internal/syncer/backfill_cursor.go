package syncer

import (
	"database/sql"
	"sort"
	"strings"
	"time"

	"github.com/emersion/go-imap/v2"
)

// LoadOlderResult 描述一次远端历史邮件回溯的结果与服务器余量状态。
type LoadOlderResult struct {
	FetchedCount  int  `json:"fetchedCount"`
	HasRemoteMore bool `json:"hasRemoteMore"`
	RemoteTotal   int  `json:"remoteTotal"`
	LocalSynced   int  `json:"localSynced"`
}

func isBackfillableFolder(folder string) bool {
	switch strings.ToLower(strings.TrimSpace(folder)) {
	case "inbox", "sent", "drafts", "archive", "spam", "trash":
		return true
	default:
		return false
	}
}

func normalizeBackfillFolder(folder string) string {
	f := strings.ToLower(strings.TrimSpace(folder))
	if f == "" {
		return "inbox"
	}
	return f
}

func normalizeBackfillLimit(limit int) int {
	if limit <= 0 {
		return 50
	}
	if limit < 10 {
		return 10
	}
	if limit > 100 {
		return 100
	}
	return limit
}

// updateMailboxSyncCursors 在单次常规同步完成后更新 last_uid、oldest_uid 与 history_exhausted。
func updateMailboxSyncCursors(
	db *sql.DB,
	mbID string,
	prevLastUID, prevOldestUID, highestUID, lowestUID uint32,
	fetchedCount int,
	remoteTotal uint32,
) {
	nowMs := time.Now().UnixMilli()
	nextLast := prevLastUID
	if highestUID > nextLast {
		nextLast = highestUID
	}
	nextOldest := prevOldestUID
	if lowestUID > 0 && (nextOldest == 0 || lowestUID < nextOldest) {
		nextOldest = lowestUID
	}

	exhausted := 0
	if remoteTotal == 0 {
		exhausted = 1
	} else if prevLastUID == 0 && lowestUID > 0 {
		// 仅当首次同步已覆盖全部远端邮件或已抵达 UID 1 时才标记历史耗尽。
		if lowestUID <= 1 || int(remoteTotal) <= fetchedCount {
			exhausted = 1
		}
	}

	if exhausted == 1 {
		_, _ = db.Exec(
			`UPDATE remote_mailboxes SET last_uid=?, oldest_uid=?, history_exhausted=1, total_count=?, updated_at=? WHERE id=?`,
			nextLast, nextOldest, remoteTotal, nowMs, mbID,
		)
		return
	}
	_, _ = db.Exec(
		`UPDATE remote_mailboxes SET last_uid=?, oldest_uid=?, total_count=?, updated_at=? WHERE id=?`,
		nextLast, nextOldest, remoteTotal, nowMs, mbID,
	)
}

func folderPriority(f string) int {
	switch f {
	case "inbox":
		return 0
	case "sent":
		return 1
	case "drafts":
		return 2
	case "archive":
		return 3
	case "spam":
		return 4
	case "trash":
		return 5
	default:
		return 9
	}
}

// pickOlderUIDBatch 从候选 UID 中过滤出严格小于 oldestUID 的最大 limit 枚，并返回是否已回溯到底。
func pickOlderUIDBatch(candidates []imap.UID, oldestUID uint32, limit int) ([]imap.UID, bool) {
	filtered := make([]imap.UID, 0, len(candidates))
	for _, u := range candidates {
		if u == 0 {
			continue
		}
		if oldestUID > 0 && uint32(u) >= oldestUID {
			continue
		}
		filtered = append(filtered, u)
	}
	if len(filtered) == 0 {
		return nil, true
	}
	sort.Slice(filtered, func(i, j int) bool { return filtered[i] > filtered[j] })
	exhausted := len(filtered) <= limit
	if len(filtered) > limit {
		filtered = filtered[:limit]
	}
	if uint32(filtered[len(filtered)-1]) <= 1 {
		exhausted = true
	}
	return filtered, exhausted
}

func resolveCurrentOldestUID(db *sql.DB, mb backfillMailboxRow) uint32 {
	if mb.OldestUID > 0 {
		return mb.OldestUID
	}
	var minUID uint32
	_ = db.QueryRow(
		`SELECT COALESCE(MIN(remote_uid), 0) FROM messages WHERE remote_mailbox_id=? AND remote_uid > 0`,
		mb.ID,
	).Scan(&minUID)
	return minUID
}
