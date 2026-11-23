package outbox

import (
	"context"
	"database/sql"
	"regexp"
	"strings"
	"time"

	"github.com/emersion/go-imap/v2"

	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

var (
	reSMTP5xx  = regexp.MustCompile(`\b5[0-9]{2}\b`)
	backoffDur = []time.Duration{
		30 * time.Second,
		2 * time.Minute,
		5 * time.Minute,
		15 * time.Minute,
		30 * time.Minute,
	}
)

func (s *Scheduler) markJobFailed(db *sql.DB, job dueJobRow, permanent bool, errMsg string, durMs int64) {
	nowMs := time.Now().UnixMilli()
	nextRetry := job.retryCount + 1
	nextState := "failed_retry"
	notBefore := nowMs
	maxR := job.maxRetries
	if maxR <= 0 {
		maxR = 5
	}
	if permanent || nextRetry >= maxR {
		nextState = "failed"
	} else {
		idx := job.retryCount
		if idx < 0 {
			idx = 0
		}
		if idx >= len(backoffDur) {
			idx = len(backoffDur) - 1
		}
		notBefore = nowMs + backoffDur[idx].Milliseconds()
	}

	_, _ = db.Exec(`
		UPDATE outbox_jobs SET state=?, retry_count=?, not_before_at=?, last_error=?, updated_at=?
		WHERE id=?
	`, nextState, nextRetry, notBefore, errMsg, nowMs, job.id)
	_, _ = db.Exec(`
		UPDATE messages SET folder='outbox', scheduled_at=0, outbox_error=? WHERE id=?
	`, errMsg, job.msgID)
	recordSendLog(db, job.accountID, "ERROR", "SMTP 投递失败", errMsg, durMs)
	s.emitOutboxAndDelta(db, job.accountID, job.id, nextState, notBefore, errMsg)
}

func isPermanentSendError(err error) bool {
	if err == nil {
		return false
	}
	low := strings.ToLower(err.Error())
	if strings.Contains(low, "err_auth_expired") || strings.Contains(low, "authentication failed") || strings.Contains(low, "invalid credentials") {
		return true
	}
	return reSMTP5xx.MatchString(err.Error())
}

func humanizeSendError(raw string) string {
	low := strings.ToLower(raw)
	switch {
	case strings.Contains(low, "550"):
		return "收件人地址被服务端拒绝 (550): " + raw
	case strings.Contains(low, "552"):
		return "邮件或附件大小超出对方服务器限制 (552): " + raw
	case strings.Contains(low, "535") || strings.Contains(low, "auth"):
		return "发件认证失败，请检查授权码或重新完成 OAuth 登录: " + raw
	case strings.Contains(low, "dial") || strings.Contains(low, "timeout") || strings.Contains(low, "no such host"):
		return "当前网络不可达或连接超时，恢复联网后将自动重发: " + raw
	default:
		return raw
	}
}

func appendToRemoteSent(parentCtx context.Context, db *sql.DB, ep mailproto.EndpointConfig, rawBytes []byte) {
	ctx, cancel := context.WithTimeout(parentCtx, 25*time.Second)
	defer cancel()

	var remoteSent string
	_ = db.QueryRow(`
		SELECT mb.remote_name FROM remote_mailboxes mb
		JOIN accounts a ON a.id = mb.account_id
		WHERE LOWER(a.email) = LOWER(?) AND mb.local_folder = 'sent' LIMIT 1
	`, ep.Email).Scan(&remoteSent)
	if remoteSent == "" {
		remoteSent = "Sent Messages"
	}

	client, err := mailproto.ConnectIMAP(ctx, ep, nil)
	if err != nil {
		return
	}
	defer func() { _ = client.Logout().Wait(); _ = client.Close() }()

	cmd := client.Append(remoteSent, int64(len(rawBytes)), &imap.AppendOptions{
		Flags: []imap.Flag{imap.FlagSeen},
		Time:  time.Now(),
	})
	_, _ = cmd.Write(rawBytes)
	_ = cmd.Close()
	_, _ = cmd.Wait()
}

func recordSendLog(db *sql.DB, accountID, level, stage, detail string, durMs int64) {
	_, _ = db.Exec(`
		INSERT INTO sync_logs(account_id, protocol, level, stage, duration_ms, message, detail, created_at)
		VALUES (?, 'SMTP', ?, ?, ?, ?, ?, ?)
	`, accountID, level, stage, durMs, stage, security.RedactSensitive(detail), time.Now().UnixMilli())
}
