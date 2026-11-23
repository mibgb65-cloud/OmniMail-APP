package syncer

import (
	"database/sql"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/security"
)

func FlushOpQueue(db *sql.DB, client *imapclient.Client, accountID string) {
	rows, err := db.Query(`SELECT id, remote_mailbox, remote_uid, op_type, target_folder, retry_count
		FROM imap_op_queue WHERE account_id=? ORDER BY id ASC LIMIT 60`, accountID)
	if err != nil {
		return
	}
	type opItem struct {
		id, retry  int
		mb, op, tf string
		uid        uint32
	}
	var ops []opItem
	for rows.Next() {
		var o opItem
		if rows.Scan(&o.id, &o.mb, &o.uid, &o.op, &o.tf, &o.retry) == nil {
			ops = append(ops, o)
		}
	}
	_ = rows.Close()

	for _, o := range ops {
		if _, err := client.Select(o.mb, nil).Wait(); err != nil {
			_, _ = db.Exec(`DELETE FROM imap_op_queue WHERE id=?`, o.id)
			continue
		}
		var uidSet imap.UIDSet
		uidSet.AddNum(imap.UID(o.uid))
		var execErr error
		switch o.op {
		case "mark_read":
			execErr = client.Store(uidSet, &imap.StoreFlags{Op: imap.StoreFlagsAdd, Silent: true, Flags: []imap.Flag{imap.FlagSeen}}, nil).Close()
		case "mark_unread":
			execErr = client.Store(uidSet, &imap.StoreFlags{Op: imap.StoreFlagsDel, Silent: true, Flags: []imap.Flag{imap.FlagSeen}}, nil).Close()
		case "star":
			execErr = client.Store(uidSet, &imap.StoreFlags{Op: imap.StoreFlagsAdd, Silent: true, Flags: []imap.Flag{imap.FlagFlagged}}, nil).Close()
		case "unstar":
			execErr = client.Store(uidSet, &imap.StoreFlags{Op: imap.StoreFlagsDel, Silent: true, Flags: []imap.Flag{imap.FlagFlagged}}, nil).Close()
		case "move":
			var dest string
			_ = db.QueryRow(`SELECT remote_name FROM remote_mailboxes WHERE account_id=? AND local_folder=? LIMIT 1`, accountID, o.tf).Scan(&dest)
			if dest != "" && dest != o.mb {
				if client.Caps().Has(imap.CapMove) || client.Caps().Has(imap.CapIMAP4rev2) {
					_, execErr = client.Move(uidSet, dest).Wait()
				} else if _, cpErr := client.Copy(uidSet, dest).Wait(); cpErr == nil {
					_ = client.Store(uidSet, &imap.StoreFlags{Op: imap.StoreFlagsAdd, Silent: true, Flags: []imap.Flag{imap.FlagDeleted}}, nil).Close()
					_ = client.UIDExpunge(uidSet).Close()
				}
			}
		case "delete_perm":
			_ = client.Store(uidSet, &imap.StoreFlags{Op: imap.StoreFlagsAdd, Silent: true, Flags: []imap.Flag{imap.FlagDeleted}}, nil).Close()
			execErr = client.UIDExpunge(uidSet).Close()
		}
		if execErr == nil || o.retry >= 3 {
			_, _ = db.Exec(`DELETE FROM imap_op_queue WHERE id=?`, o.id)
		} else {
			_, _ = db.Exec(`UPDATE imap_op_queue SET retry_count=retry_count+1, last_error=? WHERE id=?`, security.RedactSensitive(execErr.Error()), o.id)
		}
	}
}
