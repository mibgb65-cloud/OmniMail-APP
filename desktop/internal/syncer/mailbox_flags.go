package syncer

import (
	"database/sql"
	"fmt"
	"slices"
	"sort"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
)

const flagsChunkSize = 50

// buildCompactUIDSet 将离散 UID 列表排序去重并压缩为连续区间集合，大幅缩减 QQ 邮箱等服务端的指令长度。
func buildCompactUIDSet(uids []imap.UID) imap.UIDSet {
	var set imap.UIDSet
	if len(uids) == 0 {
		return set
	}
	sorted := make([]imap.UID, 0, len(uids))
	for _, u := range uids {
		if u > 0 {
			sorted = append(sorted, u)
		}
	}
	if len(sorted) == 0 {
		return set
	}
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	start, prev := sorted[0], sorted[0]
	for i := 1; i < len(sorted); i++ {
		u := sorted[i]
		if u == prev {
			continue
		}
		if u == prev+1 {
			prev = u
			continue
		}
		set.AddRange(start, prev)
		start, prev = u, u
	}
	set.AddRange(start, prev)
	return set
}

// syncExistingFlags 按 50 封分片并压缩连续 UID 区间同步已读/星标状态，显式返回协议或连接错误。
func syncExistingFlags(cli *imapclient.Client, db *sql.DB, accID, mbID string, lastUID uint32) error {
	rows, err := db.Query(
		`SELECT id, remote_uid, is_unread, is_starred FROM messages WHERE account_id=? AND remote_mailbox_id=? AND remote_uid > 0 ORDER BY received_at DESC LIMIT 120`,
		accID, mbID,
	)
	if err != nil {
		return nil
	}
	type localState struct {
		id           string
		unread, star bool
	}
	localMap := make(map[imap.UID]localState)
	var uids []imap.UID
	for rows.Next() {
		var id string
		var uid uint32
		var uInt, sInt int
		if rows.Scan(&id, &uid, &uInt, &sInt) == nil && uid <= lastUID {
			u := imap.UID(uid)
			if _, exists := localMap[u]; !exists {
				localMap[u] = localState{id: id, unread: uInt != 0, star: sInt != 0}
				uids = append(uids, u)
			}
		}
	}
	_ = rows.Close()
	if len(uids) == 0 {
		return nil
	}
	sort.Slice(uids, func(i, j int) bool { return uids[i] < uids[j] })

	for offset := 0; offset < len(uids); offset += flagsChunkSize {
		end := minInt(offset+flagsChunkSize, len(uids))
		chunkSet := buildCompactUIDSet(uids[offset:end])
		fetched, fErr := cli.Fetch(chunkSet, &imap.FetchOptions{UID: true, Flags: true}).Collect()
		if fErr != nil {
			return fmt.Errorf("同步邮件状态标志失败(UID 分片 %d-%d): %w", offset, end, fErr)
		}
		for _, fm := range fetched {
			ls, ok := localMap[fm.UID]
			if !ok {
				continue
			}
			remUnread := !slices.Contains(fm.Flags, imap.FlagSeen)
			remStar := slices.Contains(fm.Flags, imap.FlagFlagged)
			if remUnread != ls.unread || remStar != ls.star {
				_, _ = db.Exec(`UPDATE messages SET is_unread=?, is_starred=? WHERE id=?`, boolToInt(remUnread), boolToInt(remStar), ls.id)
			}
		}
	}
	return nil
}
