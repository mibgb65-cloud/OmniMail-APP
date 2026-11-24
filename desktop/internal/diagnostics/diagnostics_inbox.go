package diagnostics

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/emersion/go-imap/v2"

	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

// probeInboxReadOnly 执行轻量只读 SELECT INBOX 探测，验证收件箱实际可读而非仅登录/LIST 可通。
func probeInboxReadOnly(ctx context.Context, ep mailproto.EndpointConfig) mailproto.ProbeStepResult {
	step := mailproto.ProbeStepResult{
		Stage: "imap-inbox",
		Label: "INBOX 收件箱只读访问",
	}
	t0 := time.Now()
	cli, err := mailproto.ConnectIMAP(ctx, ep, nil)
	if err != nil {
		step.DurationMs = time.Since(t0).Milliseconds()
		step.Detail = security.RedactSensitive(err.Error())
		step.Suggestion = "无法再次建立 IMAP 连接以检查 INBOX，请留意服务器并发连接限制或网络抖动"
		return step
	}
	sel, selErr := cli.Select("INBOX", &imap.SelectOptions{ReadOnly: true}).Wait()
	_ = cli.Logout().Wait()
	_ = cli.Close()
	step.DurationMs = time.Since(t0).Milliseconds()
	if selErr != nil {
		step.Detail = security.RedactSensitive(selErr.Error())
		step.Suggestion = "IMAP 登录正常但无法打开 INBOX，请检查邮箱服务端状态或授权范围"
		return step
	}
	step.OK = true
	step.Detail = fmt.Sprintf("INBOX 只读打开正常（共 %d 封，UIDNext=%d）", sel.NumMessages, sel.UIDNext)
	return step
}

// buildRecentSyncErrorStep 检索该账户最近一条尚未恢复的同步错误日志，避免出现「顶部报错但诊断全绿」的割裂。
func buildRecentSyncErrorStep(db *sql.DB, accountID string) (*mailproto.ProbeStepResult, string, bool) {
	if db == nil || strings.TrimSpace(accountID) == "" {
		return nil, "", false
	}
	var accStatus, accLastErr string
	_ = db.QueryRow(`SELECT status, last_error FROM accounts WHERE id = ?`, accountID).Scan(&accStatus, &accLastErr)

	var errStage, errMsg, errDetail string
	var errTs, lastOKTs int64
	hasErrRow := db.QueryRow(`
		SELECT stage, message, detail, created_at
		FROM sync_logs
		WHERE account_id = ? AND LOWER(level) = 'error'
		ORDER BY id DESC LIMIT 1
	`, accountID).Scan(&errStage, &errMsg, &errDetail, &errTs) == nil

	_ = db.QueryRow(`
		SELECT COALESCE(MAX(created_at), 0)
		FROM sync_logs
		WHERE account_id = ? AND LOWER(level) = 'info' AND stage = 'imap'
	`, accountID).Scan(&lastOKTs)

	inErrorState := strings.EqualFold(strings.TrimSpace(accStatus), "error") ||
		strings.EqualFold(strings.TrimSpace(accStatus), "auth-expired")
	unresolvedLog := hasErrRow && (errTs >= lastOKTs || inErrorState)
	if !unresolvedLog && (!inErrorState || strings.TrimSpace(accLastErr) == "") {
		return nil, "", false
	}

	summary := security.RedactSensitive(strings.TrimSpace(accLastErr))
	detailParts := make([]string, 0, 3)
	if unresolvedLog {
		tsText := time.UnixMilli(errTs).Format("01-02 15:04:05")
		cleanMsg := security.RedactSensitive(strings.TrimSpace(errMsg))
		cleanDetail := security.RedactSensitive(strings.TrimSpace(errDetail))
		if summary == "" {
			summary = cleanMsg
		}
		line := fmt.Sprintf("[%s][%s] %s", tsText, errStage, cleanMsg)
		if cleanDetail != "" && cleanDetail != cleanMsg {
			line += " — " + cleanDetail
		}
		detailParts = append(detailParts, line)
	}
	if summary != "" && (len(detailParts) == 0 || !strings.Contains(detailParts[0], summary)) {
		detailParts = append(detailParts, "账户状态摘要: "+summary)
	}

	step := &mailproto.ProbeStepResult{
		Stage:      "sync-history",
		Label:      "最近同步故障记录",
		OK:         false,
		Detail:     strings.Join(detailParts, " | "),
		Suggestion: "基础连通探测仅校验握手与目录，请依据以上最近一次真实同步错误排查对应文件夹或重试同步",
	}
	return step, summary, inErrorState
}
