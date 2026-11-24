package syncer

import (
	"context"
	"math/rand/v2"
	"sort"
	"sync"
	"time"

	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
	"omnimail/internal/search"
)

var backoffSchedule = []time.Duration{
	5 * time.Second, 15 * time.Second, 30 * time.Second,
	60 * time.Second, 180 * time.Second, 300 * time.Second,
}

type SyncWorker struct {
	accountID string
	sess      *profilemgr.Session
	tm        *oauth.TokenManager
	bus       *events.Bus
	hooks     PipelineHooks
	ctx       context.Context
	cancel    context.CancelFunc
	wakeCh    chan struct{}
	wg        sync.WaitGroup
}

func newSyncWorker(parent context.Context, sess *profilemgr.Session, accountID string, tm *oauth.TokenManager, bus *events.Bus, hooks PipelineHooks) *SyncWorker {
	ctx, cancel := context.WithCancel(parent)
	w := &SyncWorker{
		accountID: accountID, sess: sess, tm: tm, bus: bus, hooks: hooks,
		ctx: ctx, cancel: cancel, wakeCh: make(chan struct{}, 1),
	}
	w.wg.Add(2)
	go w.syncLoop()
	go w.idleLoop()
	return w
}

func (w *SyncWorker) Trigger() {
	select {
	case w.wakeCh <- struct{}{}:
	default:
	}
}

func (w *SyncWorker) Stop() {
	w.cancel()
	w.wg.Wait()
}

func (w *SyncWorker) syncLoop() {
	defer w.wg.Done()
	w.Trigger()
	failures := 0
	for {
		select {
		case <-w.ctx.Done():
			return
		case <-w.wakeCh:
			err := w.runOneSyncCycle()
			if err == nil {
				failures = 0
				continue
			}
			if apperr.CodeOf(err) == apperr.CodeAuthExpired {
				continue
			}
			delay := backoffSchedule[minInt(failures, len(backoffSchedule)-1)]
			jitter := time.Duration(rand.IntN(1500)) * time.Millisecond
			failures++
			timer := time.NewTimer(delay + jitter)
			select {
			case <-w.ctx.Done():
				timer.Stop()
				return
			case <-w.wakeCh:
				timer.Stop()
				failures = 0
				w.Trigger()
			case <-timer.C:
				w.Trigger()
			}
		}
	}
}

func (w *SyncWorker) runOneSyncCycle() error {
	start := time.Now()
	w.emitSyncProgress("syncing", "正在连接收件服务器…")
	epCfg, accDTO, err := accounts.ResolveEndpointConfig(w.ctx, w.sess.DB, w.sess.Vault, w.tm, w.accountID)
	if err != nil {
		w.reportStatus("auth-expired", err.Error(), 0)
		w.emitSyncProgress("failed", "未能读取邮箱凭据")
		AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "error", "auth", time.Since(start).Milliseconds(), "读取邮箱凭据失败", err.Error())
		return err
	}
	w.reportStatus("syncing", "", 0)

	reconnect := func() (*imapclient.Client, error) {
		return mailproto.ConnectIMAP(w.ctx, epCfg, nil)
	}
	workConn, err := reconnect()
	if err != nil {
		st := "error"
		if apperr.CodeOf(err) == apperr.CodeAuthExpired {
			st = "auth-expired"
		}
		w.reportStatus(st, err.Error(), 0)
		w.emitSyncProgress("failed", "未能连接收件服务器")
		AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "error", "auth", time.Since(start).Milliseconds(), "连接收件服务器失败", err.Error())
		return err
	}
	defer func() { closeIMAPQuietly(workConn, false) }()

	FlushOpQueue(w.sess.DB, workConn, w.accountID)

	w.emitSyncProgress("syncing", "正在读取邮件文件夹…")
	boxes, err := mailproto.DiscoverMailboxes(workConn)
	if err != nil {
		w.reportStatus("error", err.Error(), 0)
		w.emitSyncProgress("failed", "未能读取邮件文件夹")
		AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "error", "list", time.Since(start).Milliseconds(), "读取邮件文件夹列表失败", err.Error())
		return err
	}
	sort.SliceStable(boxes, func(i, j int) bool {
		return folderPriority(boxes[i].LocalFolder) < folderPriority(boxes[j].LocalFolder)
	})

	allAdded, syncedBox, failedBox, folderErrors, finalConn := w.syncBoxesWithReconnect(workConn, accDTO, boxes, reconnect)
	workConn = finalConn
	if w.ctx.Err() != nil {
		return w.ctx.Err()
	}

	w.finishSyncProgress(syncedBox || len(allAdded) > 0, failedBox, summarizeFolderErrors(folderErrors))
	if w.bus != nil {
		counts, _ := search.GetFolderCounts(w.sess.DB, "")
		w.bus.Emit(events.MailDelta, events.MailDeltaPayload{
			AccountID: w.accountID, AddedIDs: allAdded, FolderCounts: counts.Counts,
		})
	}
	if !failedBox {
		AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "info", "imap", time.Since(start).Milliseconds(), "邮箱增量同步完成", "")
	}
	return nil
}

func (w *SyncWorker) reportStatus(status, lastErr string, syncedMs int64) {
	accounts.UpdateStatus(w.sess.DB, w.accountID, status, lastErr, syncedMs)
	if w.bus != nil {
		w.bus.Emit(events.AccountStatus, events.AccountStatusPayload{
			AccountID: w.accountID, Status: status, LastError: lastErr, LastSyncedAt: syncedMs,
		})
	}
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
