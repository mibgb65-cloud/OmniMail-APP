package syncer

import (
	"time"

	"omnimail/internal/events"
)

func (w *SyncWorker) emitSyncProgress(status, stage string) {
	w.bus.Emit(events.SyncProgress, events.SyncProgressPayload{
		AccountID: w.accountID, Status: status, Stage: stage,
	})
}

func (w *SyncWorker) finishSyncProgress(hasSuccess, hasFailure bool) {
	switch {
	case !hasFailure:
		w.reportStatus("connected", "", time.Now().UnixMilli())
		w.emitSyncProgress("done", "邮箱同步已完成")
	case !hasSuccess:
		w.reportStatus("error", "邮件文件夹同步失败", 0)
		w.emitSyncProgress("failed", "未能完成邮件文件夹同步")
	default:
		w.reportStatus("error", "部分邮件文件夹同步失败", 0)
		w.emitSyncProgress("partial", "部分邮件文件夹未完成同步")
	}
}
