package syncer

import (
	"strings"
	"time"

	"omnimail/internal/events"
	"omnimail/internal/security"
)

func (w *SyncWorker) emitSyncProgress(status, stage string) {
	w.bus.Emit(events.SyncProgress, events.SyncProgressPayload{
		AccountID: w.accountID, Status: status, Stage: stage,
	})
}

func (w *SyncWorker) finishSyncProgress(hasSuccess, hasFailure bool, errorSummary string) {
	cleanErr := strings.TrimSpace(security.RedactSensitive(errorSummary))
	switch {
	case !hasFailure:
		w.reportStatus("connected", "", time.Now().UnixMilli())
		w.emitSyncProgress("done", "邮箱同步已完成")
	case !hasSuccess:
		if cleanErr == "" {
			cleanErr = "邮件文件夹同步失败"
		}
		w.reportStatus("error", cleanErr, 0)
		w.emitSyncProgress("failed", cleanErr)
	default:
		if cleanErr == "" {
			cleanErr = "部分邮件文件夹同步失败"
		}
		w.reportStatus("error", cleanErr, 0)
		w.emitSyncProgress("partial", cleanErr)
	}
}
