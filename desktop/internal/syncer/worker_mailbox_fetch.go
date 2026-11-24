package syncer

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/accounts"
	"omnimail/internal/mailproto"
)

const (
	batchFetchTimeout  = 45 * time.Second
	singleFetchTimeout = 20 * time.Second
)

// shouldSkipIncrementalDiscovery 判断是否可根据 SELECT 返回的 UIDNext 安全短路增量新邮件发现。
func shouldSkipIncrementalDiscovery(prevLastUID uint32, uidNext imap.UID) bool {
	return prevLastUID > 0 && uidNext > 0 && uint32(uidNext) <= prevLastUID+1
}

// discoverIncrementalUIDs 优先使用 UID SEARCH 发现大于 prevLastUID 的新邮件，不支持时再安全回退 UID FETCH。
func discoverIncrementalUIDs(
	cli *imapclient.Client,
	remoteName string,
	prevLastUID uint32,
	reconnect imapReconnectFunc,
) ([]imap.UID, *imapclient.Client, error) {
	var newSet imap.UIDSet
	newSet.AddRange(imap.UID(prevLastUID+1), 0)

	sData, sErr := cli.UIDSearch(&imap.SearchCriteria{UID: []imap.UIDSet{newSet}}, nil).Wait()
	if sErr == nil && sData != nil {
		return filterUIDsAfter(sData.AllUIDs(), prevLastUID), cli, nil
	}
	if sErr != nil && isConnectionLevelError(sErr) && reconnect != nil {
		nextCli, _, rErr := reconnectAndSelectMailbox(cli, reconnect, remoteName)
		if rErr != nil {
			return nil, cli, fmt.Errorf("UID SEARCH 断连后重连失败: %w", rErr)
		}
		cli = nextCli
	}

	fMsgs, fErr := cli.Fetch(newSet, &imap.FetchOptions{UID: true}).Collect()
	if fErr != nil {
		return nil, cli, fmt.Errorf("发现新邮件 UID 失败(SEARCH=%v): %w", sErr, fErr)
	}
	rawUIDs := make([]imap.UID, 0, len(fMsgs))
	for _, fm := range fMsgs {
		rawUIDs = append(rawUIDs, fm.UID)
	}
	return filterUIDsAfter(rawUIDs, prevLastUID), cli, nil
}

func filterUIDsAfter(uids []imap.UID, minExclusive uint32) []imap.UID {
	if len(uids) == 0 {
		return nil
	}
	seen := make(map[imap.UID]struct{}, len(uids))
	out := make([]imap.UID, 0, len(uids))
	for _, u := range uids {
		if uint32(u) <= minExclusive {
			continue
		}
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		out = append(out, u)
	}
	return out
}

func fetchMessagesWithTimeout(
	ctx context.Context,
	cli *imapclient.Client,
	uids []imap.UID,
	bodySec *imap.FetchItemBodySection,
	timeout time.Duration,
) ([]*imapclient.FetchMessageBuffer, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	set := buildCompactUIDSet(uids)
	type result struct {
		msgs []*imapclient.FetchMessageBuffer
		err  error
	}
	ch := make(chan result, 1)
	go func() {
		msgs, err := cli.Fetch(set, &imap.FetchOptions{
			UID:          true,
			Flags:        true,
			InternalDate: true,
			RFC822Size:   true,
			BodySection:  []*imap.FetchItemBodySection{bodySec},
		}).Collect()
		ch <- result{msgs: msgs, err: err}
	}()

	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case res := <-ch:
		return res.msgs, res.err
	case <-ctx.Done():
		closeIMAPQuietly(cli, true)
		return nil, ctx.Err()
	case <-timer.C:
		closeIMAPQuietly(cli, true)
		return nil, fmt.Errorf("拉取邮件超时(%s): %w", timeout, context.DeadlineExceeded)
	}
}

// fetchBatchWithFallback 优先整批拉取，失败时重连并降级为逐封拉取，记录单封失败日志但不阻塞其余成功邮件。
func fetchBatchWithFallback(
	cli *imapclient.Client,
	db *sql.DB,
	acc accounts.EmailAccountDTO,
	mb mailproto.DiscoveredMailbox,
	batchUIDs []imap.UID,
	bodySec *imap.FetchItemBodySection,
	opts syncMailboxOptions,
) ([]*imapclient.FetchMessageBuffer, *imapclient.Client, int, error) {
	fetched, fErr := fetchMessagesWithTimeout(opts.Ctx, cli, batchUIDs, bodySec, batchFetchTimeout)
	if fErr == nil {
		return fetched, cli, 0, nil
	}
	AppendSyncLog(
		db, opts.ProfileDir, acc.ID, "IMAP", "warn", "folder-sync", 0,
		fmt.Sprintf("文件夹 %s 批量拉取失败，降级为逐封拉取（%d 封）", mb.RemoteName, len(batchUIDs)),
		fErr.Error(),
	)

	if opts.Reconnect != nil && (isConnectionLevelError(fErr) || len(batchUIDs) > 1) {
		nextCli, _, rErr := reconnectAndSelectMailbox(cli, opts.Reconnect, mb.RemoteName)
		if rErr != nil {
			return nil, cli, len(batchUIDs), fmt.Errorf("批次拉取失败且重连失败: %w", rErr)
		}
		cli = nextCli
	} else if isConnectionLevelError(fErr) {
		return nil, cli, len(batchUIDs), fErr
	}

	var out []*imapclient.FetchMessageBuffer
	var firstErr error
	failedCount := 0
	for _, u := range batchUIDs {
		t0 := time.Now()
		single, sErr := fetchMessagesWithTimeout(opts.Ctx, cli, []imap.UID{u}, bodySec, singleFetchTimeout)
		if sErr != nil {
			failedCount++
			if firstErr == nil {
				firstErr = fmt.Errorf("UID=%d 拉取失败: %w", u, sErr)
			}
			AppendSyncLog(
				db, opts.ProfileDir, acc.ID, "IMAP", "error", "message-fetch", time.Since(t0).Milliseconds(),
				fmt.Sprintf("文件夹 %s 单封邮件 UID=%d 拉取失败", mb.RemoteName, u), sErr.Error(),
			)
			if isConnectionLevelError(sErr) && opts.Reconnect != nil {
				nextCli, _, rErr := reconnectAndSelectMailbox(cli, opts.Reconnect, mb.RemoteName)
				if rErr != nil {
					return out, cli, failedCount, fmt.Errorf("单封降级重连失败: %w", rErr)
				}
				cli = nextCli
			} else if isConnectionLevelError(sErr) {
				return out, cli, failedCount, firstErr
			}
			continue
		}
		out = append(out, single...)
	}
	return out, cli, failedCount, firstErr
}

func sortUIDsForSync(uids []imap.UID, incremental bool) {
	if incremental {
		sort.Slice(uids, func(i, j int) bool { return uids[i] < uids[j] })
		return
	}
	sort.Slice(uids, func(i, j int) bool { return uids[i] > uids[j] })
}

func advanceMailboxLastUID(db *sql.DB, mbID string, nextLastUID uint32) {
	if nextLastUID == 0 {
		return
	}
	_, _ = db.Exec(
		`UPDATE remote_mailboxes SET last_uid = CASE WHEN last_uid < ? THEN ? ELSE last_uid END, updated_at=? WHERE id=?`,
		nextLastUID, nextLastUID, time.Now().UnixMilli(), mbID,
	)
}
