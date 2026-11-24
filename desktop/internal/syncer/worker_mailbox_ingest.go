package syncer

import (
	"database/sql"
	"fmt"
	"slices"
	"sort"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/accounts"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/search"
	"omnimail/internal/storage"
)

func fetchAndIngestTargetUIDs(
	cli *imapclient.Client,
	db *sql.DB,
	blobs *storage.BlobStore,
	hooks PipelineHooks,
	bus *events.Bus,
	acc accounts.EmailAccountDTO,
	mb mailproto.DiscoveredMailbox,
	mbID string,
	targetUIDs []imap.UID,
	incremental bool,
	opts syncMailboxOptions,
) ([]string, *imapclient.Client, uint32, uint32, error) {
	var addedIDs []string
	var firstErr error
	var highestContiguous, lowestSucceeded uint32
	canAdvance := true
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
		end := minInt(offset+syncBatchSize, total)
		batchUIDs := targetUIDs[offset:end]
		bodySec := &imap.FetchItemBodySection{Peek: true}
		fetched, nextCli, failedInBatch, batchErr := fetchBatchWithFallback(cli, db, acc, mb, batchUIDs, bodySec, opts)
		cli = nextCli
		if batchErr != nil && firstErr == nil {
			firstErr = batchErr
		}
		if failedInBatch > 0 {
			canAdvance = false
		}
		sort.Slice(fetched, func(i, j int) bool {
			if incremental {
				return fetched[i].UID < fetched[j].UID
			}
			return fetched[i].UID > fetched[j].UID
		})
		batchIngestFailed := false
		for _, fm := range fetched {
			raw := fm.FindBodySection(bodySec)
			if len(raw) == 0 {
				continue
			}
			mid, created, ingErr := IngestMessage(db, blobs, hooks, IngestInput{
				AccountID: acc.ID, AccountEmail: acc.Email, RemoteMailboxID: mbID,
				RemoteUID: uint32(fm.UID), Folder: mb.LocalFolder,
				IsUnread:   !slices.Contains(fm.Flags, imap.FlagSeen),
				IsStarred:  slices.Contains(fm.Flags, imap.FlagFlagged),
				ReceivedAt: fm.InternalDate, RawBytes: raw, SizeBytes: fm.RFC822Size,
			})
			if ingErr != nil {
				batchIngestFailed = true
				if firstErr == nil {
					firstErr = fmt.Errorf("入库 UID=%d 失败: %w", fm.UID, ingErr)
				}
				AppendSyncLog(db, opts.ProfileDir, acc.ID, "IMAP", "error", "message-ingest", 0, fmt.Sprintf("文件夹 %s 邮件 UID=%d 入库失败", mb.RemoteName, fm.UID), ingErr.Error())
				continue
			}
			processed++
			u32 := uint32(fm.UID)
			if lowestSucceeded == 0 || u32 < lowestSucceeded {
				lowestSucceeded = u32
			}
			if !incremental && u32 > highestContiguous {
				highestContiguous = u32
			}
			if created && mid != "" {
				addedIDs = append(addedIDs, mid)
			}
		}
		if batchIngestFailed {
			canAdvance = false
		}
		if incremental && canAdvance && len(batchUIDs) > 0 {
			batchMax := uint32(batchUIDs[len(batchUIDs)-1])
			if batchMax > highestContiguous {
				highestContiguous = batchMax
				advanceMailboxLastUID(db, mbID, batchMax)
			}
		}
		if bus != nil && mb.LocalFolder == "inbox" {
			reportInboxProgress()
			counts, _ := search.GetFolderCounts(db, "")
			bus.Emit(events.MailDelta, events.MailDeltaPayload{AccountID: acc.ID, AddedIDs: addedIDs, FolderCounts: counts.Counts})
		}
		if batchErr != nil && isConnectionLevelError(batchErr) && opts.Reconnect == nil {
			break
		}
	}
	return addedIDs, cli, highestContiguous, lowestSucceeded, firstErr
}
