package syncer

import (
	"database/sql"
	"slices"
	"sort"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/accounts"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/search"
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
	mbID := acc.ID + ":" + mb.RemoteName
	sel, err := cli.Select(mb.RemoteName, &imap.SelectOptions{ReadOnly: true}).Wait()
	if err != nil {
		return nil, err
	}

	var prevValidity, prevLastUID uint32
	_ = db.QueryRow(`SELECT uid_validity, last_uid FROM remote_mailboxes WHERE id=?`, mbID).Scan(&prevValidity, &prevLastUID)
	if prevValidity > 0 && sel.UIDValidity > 0 && prevValidity != sel.UIDValidity {
		_, _ = db.Exec(`DELETE FROM messages_fts WHERE message_id IN (SELECT id FROM messages WHERE account_id=? AND remote_mailbox_id=?)`, acc.ID, mbID)
		_, _ = db.Exec(`DELETE FROM messages WHERE account_id=? AND remote_mailbox_id=?`, acc.ID, mbID)
		prevLastUID = 0
	}

	nowMs := time.Now().UnixMilli()
	_, _ = db.Exec(`
		INSERT INTO remote_mailboxes(id, account_id, remote_name, local_folder, uid_validity, last_uid, total_count, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET local_folder=excluded.local_folder, uid_validity=excluded.uid_validity, total_count=excluded.total_count, updated_at=excluded.updated_at
	`, mbID, acc.ID, mb.RemoteName, mb.LocalFolder, sel.UIDValidity, prevLastUID, sel.NumMessages, nowMs)

	if sel.NumMessages == 0 {
		return nil, nil
	}

	var targetUIDs []imap.UID
	winDays := acc.OfflineWindowDays
	if winDays <= 0 {
		winDays = 90
	}
	if prevLastUID == 0 {
		since := time.Now().AddDate(0, 0, -winDays)
		sData, sErr := cli.UIDSearch(&imap.SearchCriteria{Since: since}, nil).Wait()
		if sErr == nil && sData != nil {
			targetUIDs = sData.AllUIDs()
		} else {
			var allSeq imap.SeqSet
			start := uint32(1)
			if sel.NumMessages > maxInitialPerBox {
				start = sel.NumMessages - maxInitialPerBox + 1
			}
			allSeq.AddRange(start, sel.NumMessages)
			fMsgs, err := cli.Fetch(allSeq, &imap.FetchOptions{UID: true}).Collect()
			if err != nil {
				return nil, err
			}
			for _, fm := range fMsgs {
				if fm.UID > 0 {
					targetUIDs = append(targetUIDs, fm.UID)
				}
			}
		}
	} else {
		syncExistingFlags(cli, db, acc.ID, mbID, prevLastUID)
		var newSet imap.UIDSet
		newSet.AddRange(imap.UID(prevLastUID+1), 0)
		fMsgs, err := cli.Fetch(newSet, &imap.FetchOptions{UID: true}).Collect()
		if err != nil {
			return nil, err
		}
		for _, fm := range fMsgs {
			if uint32(fm.UID) > prevLastUID {
				targetUIDs = append(targetUIDs, fm.UID)
			}
		}
	}

	if len(targetUIDs) == 0 {
		return nil, nil
	}
	sort.Slice(targetUIDs, func(i, j int) bool { return targetUIDs[i] > targetUIDs[j] })
	if len(targetUIDs) > maxInitialPerBox {
		targetUIDs = targetUIDs[:maxInitialPerBox]
	}
	highestUID := uint32(targetUIDs[0])

	var addedIDs []string
	var firstIngestErr error
	processed, total := 0, len(targetUIDs)
	reportInboxProgress := func() {
		if bus != nil && mb.LocalFolder == "inbox" {
			bus.Emit(events.SyncProgress, events.SyncProgressPayload{
				AccountID: acc.ID, Status: "syncing", Stage: "正在同步收件箱邮件…", Current: processed, Total: total,
			})
		}
	}
	reportInboxProgress()
	for offset := 0; offset < total; offset += syncBatchSize {
		end := offset + syncBatchSize
		if end > total {
			end = total
		}
		var batchSet imap.UIDSet
		for _, u := range targetUIDs[offset:end] {
			batchSet.AddNum(u)
		}
		bodySec := &imap.FetchItemBodySection{Peek: true}
		fetched, fErr := cli.Fetch(batchSet, &imap.FetchOptions{
			UID:          true,
			Flags:        true,
			InternalDate: true,
			RFC822Size:   true,
			BodySection:  []*imap.FetchItemBodySection{bodySec},
		}).Collect()
		if fErr != nil {
			return addedIDs, fErr
		}
		sort.Slice(fetched, func(i, j int) bool { return fetched[i].UID > fetched[j].UID })
		for _, fm := range fetched {
			raw := fm.FindBodySection(bodySec)
			if len(raw) == 0 {
				continue
			}
			isUnread := !slices.Contains(fm.Flags, imap.FlagSeen)
			isStar := slices.Contains(fm.Flags, imap.FlagFlagged)
			mid, created, ingErr := IngestMessage(db, blobs, hooks, IngestInput{
				AccountID: acc.ID, AccountEmail: acc.Email, RemoteMailboxID: mbID,
				RemoteUID: uint32(fm.UID), Folder: mb.LocalFolder,
				IsUnread: isUnread, IsStarred: isStar, ReceivedAt: fm.InternalDate,
				RawBytes: raw, SizeBytes: fm.RFC822Size,
			})
			if ingErr != nil {
				if firstIngestErr == nil {
					firstIngestErr = ingErr
				}
				continue
			}
			processed++
			if created && mid != "" {
				addedIDs = append(addedIDs, mid)
			}
		}
		if bus != nil && mb.LocalFolder == "inbox" {
			reportInboxProgress()
			counts, _ := search.GetFolderCounts(db, "")
			bus.Emit(events.MailDelta, events.MailDeltaPayload{
				AccountID: acc.ID, AddedIDs: addedIDs, FolderCounts: counts.Counts,
			})
		}
	}

	if highestUID > prevLastUID {
		_, _ = db.Exec(`UPDATE remote_mailboxes SET last_uid=?, updated_at=? WHERE id=?`, highestUID, time.Now().UnixMilli(), mbID)
	}
	return addedIDs, firstIngestErr
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
