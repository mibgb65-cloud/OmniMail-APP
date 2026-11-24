package syncer

import (
	"context"
	"slices"
	"sort"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/accounts"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
)

type backfillMailboxRow struct {
	ID          string
	AccountID   string
	RemoteName  string
	LocalFolder string
	UIDValidity uint32
	OldestUID   uint32
	LastUID     uint32
	TotalCount  uint32
}

func queryOlderRemoteUIDs(cli *imapclient.Client, oldestUID uint32, numMessages uint32) ([]imap.UID, error) {
	if oldestUID == 0 {
		if sData, err := cli.UIDSearch(&imap.SearchCriteria{}, nil).Wait(); err == nil && sData != nil {
			return sData.AllUIDs(), nil
		}
		var allSeq imap.SeqSet
		allSeq.AddRange(1, numMessages)
		fMsgs, err := cli.Fetch(allSeq, &imap.FetchOptions{UID: true}).Collect()
		if err != nil {
			return nil, err
		}
		out := make([]imap.UID, 0, len(fMsgs))
		for _, fm := range fMsgs {
			if fm.UID > 0 {
				out = append(out, fm.UID)
			}
		}
		return out, nil
	}

	var rangeSet imap.UIDSet
	rangeSet.AddRange(imap.UID(1), imap.UID(oldestUID-1))
	if sData, err := cli.UIDSearch(&imap.SearchCriteria{UID: []imap.UIDSet{rangeSet}}, nil).Wait(); err == nil && sData != nil {
		return sData.AllUIDs(), nil
	}
	fMsgs, err := cli.Fetch(rangeSet, &imap.FetchOptions{UID: true}).Collect()
	if err != nil {
		return nil, err
	}
	out := make([]imap.UID, 0, len(fMsgs))
	for _, fm := range fMsgs {
		if fm.UID > 0 && uint32(fm.UID) < oldestUID {
			out = append(out, fm.UID)
		}
	}
	return out, nil
}

func backfillSingleMailboxIMAP(
	ctx context.Context,
	sess *profilemgr.Session,
	tm *oauth.TokenManager,
	hooks PipelineHooks,
	mb backfillMailboxRow,
	limit int,
) (int, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	epCfg, accDTO, err := accounts.ResolveEndpointConfig(ctx, sess.DB, sess.Vault, tm, mb.AccountID)
	if err != nil {
		return 0, err
	}
	cli, err := mailproto.ConnectIMAP(ctx, epCfg, nil)
	if err != nil {
		return 0, err
	}
	defer func() {
		_ = cli.Logout().Wait()
		_ = cli.Close()
	}()

	sel, err := cli.Select(mb.RemoteName, &imap.SelectOptions{ReadOnly: true}).Wait()
	if err != nil {
		return 0, err
	}
	nowMs := time.Now().UnixMilli()
	if mb.UIDValidity > 0 && sel.UIDValidity > 0 && mb.UIDValidity != sel.UIDValidity {
		_, _ = sess.DB.Exec(`DELETE FROM messages_fts WHERE message_id IN (SELECT id FROM messages WHERE account_id=? AND remote_mailbox_id=?)`, mb.AccountID, mb.ID)
		_, _ = sess.DB.Exec(`DELETE FROM messages WHERE account_id=? AND remote_mailbox_id=?`, mb.AccountID, mb.ID)
		_, _ = sess.DB.Exec(`UPDATE remote_mailboxes SET uid_validity=?, last_uid=0, oldest_uid=0, history_exhausted=0, total_count=?, updated_at=? WHERE id=?`, sel.UIDValidity, sel.NumMessages, nowMs, mb.ID)
		mb.OldestUID, mb.LastUID = 0, 0
	} else {
		_, _ = sess.DB.Exec(`UPDATE remote_mailboxes SET total_count=?, updated_at=? WHERE id=?`, sel.NumMessages, nowMs, mb.ID)
	}
	if sel.NumMessages == 0 {
		_, _ = sess.DB.Exec(`UPDATE remote_mailboxes SET history_exhausted=1, updated_at=? WHERE id=?`, nowMs, mb.ID)
		return 0, nil
	}

	oldestUID := resolveCurrentOldestUID(sess.DB, mb)
	if oldestUID == 1 {
		_, _ = sess.DB.Exec(`UPDATE remote_mailboxes SET oldest_uid=1, history_exhausted=1, updated_at=? WHERE id=?`, nowMs, mb.ID)
		return 0, nil
	}
	candidates, err := queryOlderRemoteUIDs(cli, oldestUID, sel.NumMessages)
	if err != nil {
		return 0, err
	}
	batchUIDs, exhausted := pickOlderUIDBatch(candidates, oldestUID, limit)
	if len(batchUIDs) == 0 {
		_, _ = sess.DB.Exec(`UPDATE remote_mailboxes SET oldest_uid=?, history_exhausted=1, updated_at=? WHERE id=?`, oldestUID, nowMs, mb.ID)
		return 0, nil
	}

	fetchedTotal := 0
	committedOldest := oldestUID
	highestSeen := mb.LastUID
	for offset := 0; offset < len(batchUIDs); offset += syncBatchSize {
		if err := ctx.Err(); err != nil {
			saveBackfillProgress(sess.DB, mb.ID, committedOldest, highestSeen, sel.NumMessages, false)
			return fetchedTotal, err
		}
		end := minInt(offset+syncBatchSize, len(batchUIDs))
		var batchSet imap.UIDSet
		for _, u := range batchUIDs[offset:end] {
			batchSet.AddNum(u)
		}
		bodySec := &imap.FetchItemBodySection{Peek: true}
		fetched, fErr := cli.Fetch(batchSet, &imap.FetchOptions{
			UID: true, Flags: true, InternalDate: true, RFC822Size: true,
			BodySection: []*imap.FetchItemBodySection{bodySec},
		}).Collect()
		if fErr != nil {
			saveBackfillProgress(sess.DB, mb.ID, committedOldest, highestSeen, sel.NumMessages, false)
			return fetchedTotal, fErr
		}
		sort.Slice(fetched, func(i, j int) bool { return fetched[i].UID > fetched[j].UID })
		for _, fm := range fetched {
			raw := fm.FindBodySection(bodySec)
			if len(raw) == 0 {
				continue
			}
			_, created, ingErr := IngestMessage(sess.DB, sess.Blobs, hooks, IngestInput{
				AccountID: accDTO.ID, AccountEmail: accDTO.Email, RemoteMailboxID: mb.ID,
				RemoteUID: uint32(fm.UID), Folder: mb.LocalFolder,
				IsUnread:   !slices.Contains(fm.Flags, imap.FlagSeen),
				IsStarred:  slices.Contains(fm.Flags, imap.FlagFlagged),
				ReceivedAt: fm.InternalDate, RawBytes: raw, SizeBytes: fm.RFC822Size,
			})
			if ingErr == nil && created {
				fetchedTotal++
			}
		}
		// 本批次成功入库后推进游标至本批最小 UID。
		if top := uint32(batchUIDs[offset]); top > highestSeen {
			highestSeen = top
		}
		if low := uint32(batchUIDs[end-1]); committedOldest == 0 || low < committedOldest {
			committedOldest = low
		}
	}
	saveBackfillProgress(sess.DB, mb.ID, committedOldest, highestSeen, sel.NumMessages, exhausted)
	return fetchedTotal, nil
}
