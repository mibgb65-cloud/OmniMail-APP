package diagnostics

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
)

type SyncLogFilter struct {
	AccountID string `json:"accountId,omitempty"`
	Level     string `json:"level,omitempty"`
	Protocol  string `json:"protocol,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}

type SyncLogEntry struct {
	ID         int64  `json:"id"`
	TimeText   string `json:"timeText"`
	AccountID  string `json:"accountId"`
	AccountTag string `json:"accountTag"`
	Protocol   string `json:"protocol"`
	Level      string `json:"level"`
	Stage      string `json:"stage"`
	DurationMs int64  `json:"durationMs"`
	Message    string `json:"message"`
	Detail     string `json:"detail"`
}

type DiagnosticReport struct {
	AccountID string                      `json:"accountId"`
	Email     string                      `json:"email"`
	ProxyHint string                      `json:"proxyHint"`
	OK        bool                        `json:"ok"`
	Summary   string                      `json:"summary"`
	Steps     []mailproto.ProbeStepResult `json:"steps"`
}

type ReceivedHop struct {
	Index    int    `json:"index"`
	FromHost string `json:"fromHost"`
	ByHost   string `json:"byHost"`
	TLSInfo  string `json:"tlsInfo"`
	RawLine  string `json:"rawLine"`
}

type RawSourceView struct {
	MailID     string        `json:"mailId"`
	SPF        string        `json:"spf"`
	DKIM       string        `json:"dkim"`
	DMARC      string        `json:"dmarc"`
	Hops       []ReceivedHop `json:"hops"`
	RawHeaders string        `json:"rawHeaders"`
	RawSource  string        `json:"rawSource"`
	Truncated  bool          `json:"truncated"`
	TotalBytes int64         `json:"totalBytes"`
}

func RunAccountDiagnostics(ctx context.Context, sess *profilemgr.Session, tm *oauth.TokenManager, accountID string) (DiagnosticReport, error) {
	if strings.TrimSpace(accountID) == "" {
		_ = sess.DB.QueryRow(`SELECT id FROM accounts ORDER BY is_default DESC, created_at ASC LIMIT 1`).Scan(&accountID)
	}
	if accountID == "" {
		return DiagnosticReport{}, apperr.New(apperr.CodeNotFound, "当前空间尚无邮箱账户可供诊断")
	}
	ep, dto, err := accounts.ResolveEndpointConfig(ctx, sess.DB, sess.Vault, tm, accountID)
	if err != nil {
		return DiagnosticReport{}, err
	}
	probeCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	rep := mailproto.TestConnection(probeCtx, ep)
	steps := append([]mailproto.ProbeStepResult{}, rep.Steps...)
	overallOK := rep.OK
	summary := security.RedactSensitive(rep.Summary)

	if rep.OK {
		inboxStep := probeInboxReadOnly(probeCtx, ep)
		steps = append(steps, inboxStep)
		if !inboxStep.OK {
			overallOK = false
			summary = inboxStep.Suggestion
		}
	}
	if histStep, histSummary, inErrState := buildRecentSyncErrorStep(sess.DB, dto.ID); histStep != nil {
		steps = append(steps, *histStep)
		if overallOK && inErrState {
			overallOK = false
			summary = "基础通道连通，但最近同步受阻: " + histSummary
		} else if overallOK && histSummary != "" {
			summary = summary + "（注意：存在最近同步告警，详见诊断步骤）"
		}
	}

	proxyHint := "直连（未检测到显式 HTTP_PROXY）"
	if req, rErr := http.NewRequest(http.MethodGet, "https://example.com", nil); rErr == nil {
		if u, pErr := http.ProxyFromEnvironment(req); pErr == nil && u != nil {
			proxyHint = "检测到系统环境变量代理: " + u.Host
		}
	}
	return DiagnosticReport{
		AccountID: dto.ID,
		Email:     dto.Email,
		ProxyHint: proxyHint,
		OK:        overallOK,
		Summary:   summary,
		Steps:     steps,
	}, nil
}

func ListSyncLogs(db *sql.DB, f SyncLogFilter) ([]SyncLogEntry, error) {
	where := []string{"1=1"}
	var args []any
	if strings.TrimSpace(f.AccountID) != "" && f.AccountID != "all" {
		where = append(where, "l.account_id = ?")
		args = append(args, f.AccountID)
	}
	if strings.TrimSpace(f.Level) != "" && f.Level != "all" {
		where = append(where, "UPPER(l.level) = UPPER(?)")
		args = append(args, f.Level)
	}
	if strings.TrimSpace(f.Protocol) != "" && f.Protocol != "all" {
		where = append(where, "UPPER(l.protocol) = UPPER(?)")
		args = append(args, f.Protocol)
	}
	limit := f.Limit
	if limit <= 0 || limit > 500 {
		limit = 150
	}
	args = append(args, limit)

	rows, err := db.Query(`
		SELECT l.id, l.account_id, COALESCE(a.short_tag, '系统'), l.protocol, l.level,
		       l.stage, l.duration_ms, l.message, l.detail, l.created_at
		FROM sync_logs l
		LEFT JOIN accounts a ON a.id = l.account_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY l.id DESC LIMIT ?
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]SyncLogEntry, 0)
	for rows.Next() {
		var item SyncLogEntry
		var ts int64
		if rows.Scan(&item.ID, &item.AccountID, &item.AccountTag, &item.Protocol, &item.Level,
			&item.Stage, &item.DurationMs, &item.Message, &item.Detail, &ts) == nil {
			item.Message = security.RedactSensitive(item.Message)
			item.Detail = security.RedactSensitive(item.Detail)
			item.TimeText = time.UnixMilli(ts).Format("01-02 15:04:05")
			out = append(out, item)
		}
	}
	return out, nil
}
