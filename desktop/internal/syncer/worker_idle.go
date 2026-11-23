package syncer

import (
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
)

const idleKeepaliveInterval = 24 * time.Minute

func (w *SyncWorker) idleLoop() {
	defer w.wg.Done()
	failures := 0
	for {
		select {
		case <-w.ctx.Done():
			return
		default:
		}
		epCfg, accDTO, err := accounts.ResolveEndpointConfig(w.ctx, w.sess.DB, w.sess.Vault, w.tm, w.accountID)
		if err != nil || !accDTO.ImapIdle {
			if !w.sleepWithCtx(60 * time.Second) {
				return
			}
			continue
		}

		unilateral := &imapclient.UnilateralDataHandler{
			Mailbox: func(_ *imapclient.UnilateralDataMailbox) {
				w.Trigger()
			},
			Expunge: func(_ uint32) {
				w.Trigger()
			},
		}
		idleConn, err := mailproto.ConnectIMAP(w.ctx, epCfg, unilateral)
		if err != nil {
			if apperr.CodeOf(err) == apperr.CodeAuthExpired {
				if !w.sleepWithCtx(90 * time.Second) {
					return
				}
				continue
			}
			delay := backoffSchedule[minInt(failures, len(backoffSchedule)-1)]
			failures++
			if !w.sleepWithCtx(delay) {
				return
			}
			continue
		}
		failures = 0

		if !idleConn.Caps().Has(imap.CapIdle) || selectInboxReadOnly(idleConn) != nil {
			_ = idleConn.Close()
			// 服务端不支持 IDLE 时自动退回轮询调度器
			if !w.sleepWithCtx(5 * time.Minute) {
				return
			}
			continue
		}

		w.holdIdleCycles(idleConn)
		_ = idleConn.Close()
	}
}

func selectInboxReadOnly(cli *imapclient.Client) error {
	_, err := cli.Select("INBOX", &imap.SelectOptions{ReadOnly: true}).Wait()
	return err
}

func (w *SyncWorker) holdIdleCycles(idleConn *imapclient.Client) {
	for {
		idleCmd, err := idleConn.Idle()
		if err != nil {
			return
		}
		timer := time.NewTimer(idleKeepaliveInterval)
		select {
		case <-w.ctx.Done():
			timer.Stop()
			_ = idleCmd.Close()
			return
		case <-idleConn.Closed():
			timer.Stop()
			return
		case <-timer.C:
			// 每 24 分钟主动发送 DONE -> NOOP -> 重入 IDLE 防止 NAT 静默断流
			if err := idleCmd.Close(); err != nil {
				return
			}
			if err := idleConn.Noop().Wait(); err != nil {
				return
			}
		}
	}
}

func (w *SyncWorker) sleepWithCtx(d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-w.ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
