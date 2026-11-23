package syncer

import (
	"database/sql"
	"slices"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
)

func syncExistingFlags(cli *imapclient.Client, db *sql.DB, accID, mbID string, lastUID uint32) {
	rows, err := db.Query(`SELECT id, remote_uid, is_unread, is_starred FROM messages WHERE account_id=? AND remote_mailbox_id=? AND remote_uid > 0 ORDER BY received_at DESC LIMIT 120`, accID, mbID)
	if err != nil {
		return
	}
	type localState struct {
		id           string
		unread, star bool
	}
	localMap := make(map[imap.UID]localState)
	var checkSet imap.UIDSet
	for rows.Next() {
		var id string
		var uid uint32
		var uInt, sInt int
		if rows.Scan(&id, &uid, &uInt, &sInt) == nil && uid <= lastUID {
			localMap[imap.UID(uid)] = localState{id: id, unread: uInt != 0, star: sInt != 0}
			checkSet.AddNum(imap.UID(uid))
		}
	}
	_ = rows.Close()
	if len(localMap) == 0 {
		return
	}
	fetched, err := cli.Fetch(checkSet, &imap.FetchOptions{UID: true, Flags: true}).Collect()
	if err != nil {
		return
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
