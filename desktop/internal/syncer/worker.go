package syncer

import (
	"context"
	"math/rand/v2"
	"sort"
	"sync"
	"time"

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
				// 认证已失效时暂停自动重试，等待用户重新授权
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
	epCfg, accDTO, err := accounts.ResolveEndpointConfig(w.ctx, w.sess.DB, w.sess.Vault, w.tm, w.accountID)
	if err != nil {
		w.reportStatus("auth-expired", err.Error(), 0)
		return err
	}
	w.reportStatus("syncing", "", 0)

	workConn, err := mailproto.ConnectIMAP(w.ctx, epCfg, nil)
	if err != nil {
		st := "error"
		if apperr.CodeOf(err) == apperr.CodeAuthExpired {
			st = "auth-expired"
		}
		w.reportStatus(st, err.Error(), 0)
		AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "error", "auth", time.Since(start).Milliseconds(), "连接收件服务器失败", err.Error())
		return err
	}
	defer func() {
		_ = workConn.Logout().Wait()
		_ = workConn.Close()
	}()

	FlushOpQueue(w.sess.DB, workConn, w.accountID)

	boxes, err := mailproto.DiscoverMailboxes(workConn)
	if err != nil {
		w.reportStatus("error", err.Error(), 0)
		return err
	}
	sort.SliceStable(boxes, func(i, j int) bool {
		return folderPriority(boxes[i].LocalFolder) < folderPriority(boxes[j].LocalFolder)
	})

	var allAdded []string
	for _, mb := range boxes {
		if mb.NoSelect || mb.LocalFolder == "custom" {
			continue
		}
		select {
		case <-w.ctx.Done():
			return w.ctx.Err()
		default:
		}
		added, mbErr := syncSingleMailbox(workConn, w.sess.DB, w.sess.Blobs, w.hooks, w.bus, accDTO, mb)
		if mbErr == nil && len(added) > 0 {
			allAdded = append(allAdded, added...)
		}
	}

	nowMs := time.Now().UnixMilli()
	w.reportStatus("connected", "", nowMs)
	if w.bus != nil {
		w.bus.Emit(events.SyncProgress, events.SyncProgressPayload{
			AccountID: w.accountID, Stage: "同步已完成", Current: 1, Total: 1, Percent: 100,
		})
		counts, _ := search.GetFolderCounts(w.sess.DB, "")
		w.bus.Emit(events.MailDelta, events.MailDeltaPayload{
			AccountID: w.accountID, AddedIDs: allAdded, FolderCounts: counts.Counts,
		})
	}
	AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "info", "imap", time.Since(start).Milliseconds(), "邮箱增量同步完成", "")
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

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
