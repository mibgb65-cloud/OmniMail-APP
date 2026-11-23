package syncer

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

type PreIngestDecision struct {
	OverrideFolder string
	MarkRead       bool
	MarkStarred    bool
	AddLabelIDs    []string
	SecurityJSON   string
	MeetingJSON    string
	SuppressNotify bool
}

// PipelineHooks 解耦同步入库管线与通讯录提取、黑名单、规则引擎、钓鱼评分、ICS 解析和休假回复。
type PipelineHooks interface {
	BeforeMessageInsert(tx *sql.Tx, accountID, accountEmail string, parsed *mailproto.ParsedEmail, defaultFolder string) PreIngestDecision
	AfterMessageCommit(db *sql.DB, accountID, accountEmail, msgID, finalFolder string, parsed *mailproto.ParsedEmail, isNew bool, suppressNotify bool)
}

func AppendSyncLog(
	db *sql.DB,
	profileDir, accountID, protocol, level, stage string,
	durMs int64,
	message, detail string,
) {
	cleanMsg := security.RedactSensitive(message)
	cleanDetail := security.RedactSensitive(detail)
	now := time.Now()

	if db != nil {
		_, _ = db.Exec(`
			INSERT INTO sync_logs(account_id, protocol, level, stage, duration_ms, message, detail, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, accountID, protocol, level, stage, durMs, cleanMsg, cleanDetail, now.UnixMilli())
		// 环状保留最近 2000 条记录
		_, _ = db.Exec(`DELETE FROM sync_logs WHERE id NOT IN (SELECT id FROM sync_logs ORDER BY id DESC LIMIT 2000)`)
	}

	if profileDir != "" {
		logsDir := filepath.Join(profileDir, "logs")
		_ = os.MkdirAll(logsDir, 0o700)
		logFile := filepath.Join(logsDir, "sync.log")
		rotateLogIfNeeded(logFile, 5*1024*1024)
		line := fmt.Sprintf("[%s] [%s] [%s/%s] acc=%s (%dms) %s %s\n",
			now.Format("2006-01-02 15:04:05"), level, protocol, stage, accountID, durMs, cleanMsg, cleanDetail)
		if f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600); err == nil {
			_, _ = f.WriteString(line)
			_ = f.Close()
		}
	}
}

func rotateLogIfNeeded(path string, maxBytes int64) {
	st, err := os.Stat(path)
	if err != nil || st.Size() < maxBytes {
		return
	}
	_ = os.Remove(path + ".2")
	_ = os.Rename(path+".1", path+".2")
	_ = os.Rename(path, path+".1")
}
