package syncer

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/accounts"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/storage"
)

const (
	syncBatchSize    = 25
	maxInitialPerBox = 150
)

func syncSingleMailbox(
	cli *imapclient.Client,
	db *sql.DB,
	blobs *storage.BlobStore,
	hooks PipelineHooks,
	bus *events.Bus,
	acc accounts.EmailAccountDTO,
	mb mailproto.DiscoveredMailbox,
) ([]string, error) {
	added, _, err := syncSingleMailboxWithOptions(cli, db, blobs, hooks, bus, acc, mb, syncMailboxOptions{})
	return added, err
}

func syncSingleMailboxWithOptions(
	cli *imapclient.Client,
	db *sql.DB,
	blobs *storage.BlobStore,
	hooks PipelineHooks,
	bus *events.Bus,
	acc accounts.EmailAccountDTO,
	mb mailproto.DiscoveredMailbox,
	opts syncMailboxOptions,
) ([]string, *imapclient.Client, error) {
	mbID := acc.ID + ":" + mb.RemoteName
	sel, err := cli.Select(mb.RemoteName, &imap.SelectOptions{ReadOnly: true}).Wait()
	if err != nil {
		return nil, cli, fmt.Errorf("SELECT %s 失败: %w", mb.RemoteName, err)
	}

	var prevValidity, prevLastUID, prevOldestUID uint32
	_ = db.QueryRow(`SELECT uid_validity, last_uid, oldest_uid FROM remote_mailboxes WHERE id=?`, mbID).Scan(&prevValidity, &prevLastUID, &prevOldestUID)
	validityReset := prevValidity > 0 && sel.UIDValidity > 0 && prevValidity != sel.UIDValidity
	if validityReset {
		_, _ = db.Exec(`DELETE FROM messages_fts WHERE message_id IN (SELECT id FROM messages WHERE account_id=? AND remote_mailbox_id=?)`, acc.ID, mbID)
		_, _ = db.Exec(`DELETE FROM messages WHERE account_id=? AND remote_mailbox_id=?`, acc.ID, mbID)
		prevLastUID, prevOldestUID = 0, 0
	}

	nowMs := time.Now().UnixMilli()
	if validityReset {
		_, _ = db.Exec(`UPDATE remote_mailboxes SET uid_validity=?, last_uid=0, oldest_uid=0, history_exhausted=0, total_count=?, updated_at=? WHERE id=?`, sel.UIDValidity, sel.NumMessages, nowMs, mbID)
	}
	_, _ = db.Exec(`
		INSERT INTO remote_mailboxes(id, account_id, remote_name, local_folder, uid_validity, last_uid, oldest_uid, history_exhausted, total_count, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
		ON CONFLICT(id) DO UPDATE SET local_folder=excluded.local_folder, uid_validity=excluded.uid_validity, total_count=excluded.total_count, updated_at=excluded.updated_at
	`, mbID, acc.ID, mb.RemoteName, mb.LocalFolder, sel.UIDValidity, prevLastUID, prevOldestUID, sel.NumMessages, nowMs)

	if sel.NumMessages == 0 {
		updateMailboxSyncCursors(db, mbID, prevLastUID, prevOldestUID, 0, 0, 0, 0)
		return nil, cli, nil
	}

	var targetUIDs []imap.UID
	incremental := prevLastUID > 0
	if !incremental {
		targetUIDs, err = discoverInitialUIDs(cli, acc.OfflineWindowDays, sel.NumMessages)
		if err != nil {
			return nil, cli, err
		}
	} else {
		if flagErr := syncExistingFlags(cli, db, acc.ID, mbID, prevLastUID); flagErr != nil {
			AppendSyncLog(db, opts.ProfileDir, acc.ID, "IMAP", "warn", "flags-sync", 0, fmt.Sprintf("文件夹 %s 同步状态标志异常", mb.RemoteName), flagErr.Error())
			if isConnectionLevelError(flagErr) {
				nextCli, nextSel, rErr := reconnectAndSelectMailbox(cli, opts.Reconnect, mb.RemoteName)
				if rErr != nil {
					return nil, cli, fmt.Errorf("同步标志断连后重连失败: %w", flagErr)
				}
				cli, sel = nextCli, nextSel
			}
		}
		if shouldSkipIncrementalDiscovery(prevLastUID, sel.UIDNext) {
			return nil, cli, nil
		}
		targetUIDs, cli, err = discoverIncrementalUIDs(cli, mb.RemoteName, prevLastUID, opts.Reconnect)
		if err != nil {
			return nil, cli, err
		}
	}

	if len(targetUIDs) == 0 {
		return nil, cli, nil
	}
	if !incremental {
		sortUIDsForSync(targetUIDs, false)
		if len(targetUIDs) > maxInitialPerBox {
			targetUIDs = targetUIDs[:maxInitialPerBox]
		}
	} else {
		sortUIDsForSync(targetUIDs, true)
	}

	addedIDs, cli, highestContiguous, lowestSucceeded, firstErr := fetchAndIngestTargetUIDs(
		cli, db, blobs, hooks, bus, acc, mb, mbID, targetUIDs, incremental, opts,
	)
	if !incremental {
		if firstErr == nil && highestContiguous > 0 {
			updateMailboxSyncCursors(db, mbID, prevLastUID, prevOldestUID, highestContiguous, lowestSucceeded, len(targetUIDs), sel.NumMessages)
		} else if lowestSucceeded > 0 {
			updateMailboxSyncCursors(db, mbID, prevLastUID, prevOldestUID, 0, lowestSucceeded, len(addedIDs), sel.NumMessages)
		}
	} else if highestContiguous > prevLastUID {
		updateMailboxSyncCursors(db, mbID, prevLastUID, prevOldestUID, highestContiguous, lowestSucceeded, len(addedIDs), sel.NumMessages)
	}
	return addedIDs, cli, firstErr
}

func discoverInitialUIDs(cli *imapclient.Client, offlineDays int, numMessages uint32) ([]imap.UID, error) {
	if offlineDays <= 0 {
		offlineDays = 90
	}
	since := time.Now().AddDate(0, 0, -offlineDays)
	if sData, sErr := cli.UIDSearch(&imap.SearchCriteria{Since: since}, nil).Wait(); sErr == nil && sData != nil {
		return sData.AllUIDs(), nil
	}
	var allSeq imap.SeqSet
	start := uint32(1)
	if numMessages > maxInitialPerBox {
		start = numMessages - maxInitialPerBox + 1
	}
	allSeq.AddRange(start, numMessages)
	fMsgs, err := cli.Fetch(allSeq, &imap.FetchOptions{UID: true}).Collect()
	if err != nil {
		return nil, fmt.Errorf("首次同步拉取 UID 列表失败: %w", err)
	}
	uids := make([]imap.UID, 0, len(fMsgs))
	for _, fm := range fMsgs {
		if fm.UID > 0 {
			uids = append(uids, fm.UID)
		}
	}
	return uids, nil
}
