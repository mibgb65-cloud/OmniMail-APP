package service

import (
	"context"

	"omnimail/desktop/internal/domain"
)

const syncBodyBatchLimit = 32

type syncBodyBudgetKey struct{}
type syncBodyBudget struct {
	count, headers int
	bytes          uint64
}

func bodySyncContext(ctx context.Context) context.Context {
	if _, ok := ctx.Value(syncBodyBudgetKey{}).(*syncBodyBudget); ok {
		return ctx
	}
	return context.WithValue(ctx, syncBodyBudgetKey{}, &syncBodyBudget{})
}

func bodyBudget(ctx context.Context) *syncBodyBudget {
	budget, _ := ctx.Value(syncBodyBudgetKey{}).(*syncBodyBudget)
	return budget
}

func (b *syncBodyBudget) permits(size uint32) bool {
	cost := max(uint64(size), 1<<20)
	// 复用连接仍须给 IMAP 元数据留余量；单封较大正文只在新连接尚未读取邮件头时下载。
	return b.count < syncBodyBatchLimit && b.headers <= 4 &&
		(b.bytes+cost <= 32<<20 || (b.count == 0 && b.headers == 0 && cost <= 40<<20))
}

func (s *Mail) pendingBodies(ctx context.Context, accountID, mailboxID string, validity uint32, limit int) ([]domain.MailBodyTarget, error) {
	targets, err := s.store.PendingMailBodies(ctx, accountID, mailboxID, validity, limit)
	return targets, syncStepError("load_body_backlog", "", err)
}

func (s *Mail) bodyTargetExists(ctx context.Context, accountID, mailboxID string, validity uint32, uid uint32, session domain.MailSession) (bool, error) {
	remote, found, err := session.LocateUID(uid)
	if err != nil {
		return false, syncStepError("persist_body", "", err)
	}
	if found && remote < uid {
		return false, syncStepError("persist_body", "", domain.ErrProtocol)
	}
	if found && remote == uid {
		return true, nil
	}
	// 只有当前 UID 清单确认消失时才核对该单一实例；不把未知 FETCH 失败当成远端删除。
	err = s.store.SaveMailBatch(ctx, accountID, mailboxID, validity, uid, uid, nil, nil)
	return false, syncStepError("reconcile_body", "", err)
}

// 同一有界步骤内完成存在性确认、预算检查与数据库提交，避免将正文失败误当作已下载。
func (s *Mail) syncStoredBodies(ctx context.Context, accountID, mailboxID string, validity uint32, session domain.MailSession) (pending, downloaded bool, err error) {
	ctx = bodySyncContext(ctx)
	targets, err := s.pendingBodies(ctx, accountID, mailboxID, validity, syncBodyBatchLimit+1)
	if err != nil {
		return false, false, err
	}
	budget := bodyBudget(ctx)
	for _, target := range targets {
		if err := ctx.Err(); err != nil {
			return true, downloaded, err
		}
		if syncShouldYield(ctx) {
			return true, downloaded, nil
		}
		exists, err := s.bodyTargetExists(ctx, accountID, mailboxID, validity, target.UID, session)
		if err != nil {
			return true, downloaded, err
		}
		if !exists {
			continue
		}
		if target.Size > 40<<20 {
			return true, downloaded, syncStepError("persist_body", "", domain.ErrTooLarge)
		}
		if syncShouldYield(ctx) || !budget.permits(target.Size) {
			return true, downloaded, nil
		}
		// 查询后可能已有前台完成保存；不占用前台通道，也不重复下载已确认正文。
		detail, err := s.store.ReadMail(ctx, target.ID)
		if err != nil {
			return true, downloaded, syncStepError("persist_body", "", err)
		}
		if detail.Cached && detail.BodyVersion >= 1 {
			continue
		}
		budget.count++
		budget.bytes += max(uint64(target.Size), 1<<20)
		if err := s.storeMessageBody(ctx, target.ID, target.UID, session); err != nil {
			return true, downloaded, syncStepError("persist_body", "", err)
		}
		downloaded = true
	}
	remaining, err := s.pendingBodies(ctx, accountID, mailboxID, validity, 1)
	return len(remaining) > 0, downloaded, err
}
