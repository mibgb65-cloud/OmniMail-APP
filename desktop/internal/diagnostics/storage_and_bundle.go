package diagnostics

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
)

type StorageBreakdown struct {
	ProfileDir          string `json:"profileDir"`
	DatabaseBytes       int64  `json:"databaseBytes"`
	RawMessagesBytes    int64  `json:"rawMessagesBytes"`
	AttachmentsBytes    int64  `json:"attachmentsBytes"`
	LogsAndExportsBytes int64  `json:"logsAndExportsBytes"`
	TotalUsedBytes      int64  `json:"totalUsedBytes"`
	DiskFreeBytes       int64  `json:"diskFreeBytes"`
}

var (
	reHopFrom = regexp.MustCompile(`(?i)\bfrom\s+([^\s;()]+)`)
	reHopBy   = regexp.MustCompile(`(?i)\bby\s+([^\s;()]+)`)
	reHopTLS  = regexp.MustCompile(`(?i)\b(TLSv1\.[0-3][^\s;()]*)`)
)

func GetMessageRawSource(sess *profilemgr.Session, mailID string) (RawSourceView, error) {
	var rawSHA, rawHeaders, bodyText string
	err := sess.DB.QueryRow(`SELECT raw_blob_sha256, raw_headers, body_text FROM messages WHERE id = ?`,
		strings.TrimSpace(mailID)).Scan(&rawSHA, &rawHeaders, &bodyText)
	if err != nil {
		return RawSourceView{}, apperr.New(apperr.CodeNotFound, "未找到该邮件记录")
	}

	var rawBytes []byte
	if rawSHA != "" && sess.Blobs != nil {
		rawBytes, _ = sess.Blobs.GetRawEML(rawSHA)
	}
	if len(rawBytes) == 0 {
		rawBytes = []byte(rawHeaders + "\r\n\r\n" + bodyText)
	}
	total := int64(len(rawBytes))
	truncated := false
	const maxView = 2 * 1024 * 1024
	viewText := string(rawBytes)
	if len(rawBytes) > maxView {
		truncated = true
		viewText = string(rawBytes[:maxView]) + "\n\n[--- 源码超过 2 MB，后续大附件 Base64 已截断，请导出 .eml 查看完整文件 ---]"
	}

	spf, dkim, dmarc := security.ParseAuthResults(rawHeaders)
	return RawSourceView{
		MailID:     mailID,
		SPF:        spf,
		DKIM:       dkim,
		DMARC:      dmarc,
		Hops:       parseReceivedHops(rawHeaders),
		RawHeaders: rawHeaders,
		RawSource:  viewText,
		Truncated:  truncated,
		TotalBytes: total,
	}, nil
}

func parseReceivedHops(rawHeaders string) []ReceivedHop {
	unfolded := strings.ReplaceAll(strings.ReplaceAll(rawHeaders, "\r\n ", " "), "\n ", " ")
	unfolded = strings.ReplaceAll(strings.ReplaceAll(unfolded, "\r\n\t", " "), "\n\t", " ")
	var lines []string
	for _, l := range strings.Split(strings.ReplaceAll(unfolded, "\r\n", "\n"), "\n") {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(l)), "received:") {
			lines = append(lines, strings.TrimSpace(l[9:]))
		}
	}
	// Received 头按倒序压栈，反转后展示从发端到收端的真实路由顺序
	hops := make([]ReceivedHop, 0, len(lines))
	for i := len(lines) - 1; i >= 0; i-- {
		raw := lines[i]
		hop := ReceivedHop{Index: len(hops) + 1, RawLine: raw}
		if m := reHopFrom.FindStringSubmatch(raw); len(m) == 2 {
			hop.FromHost = m[1]
		}
		if m := reHopBy.FindStringSubmatch(raw); len(m) == 2 {
			hop.ByHost = m[1]
		}
		if m := reHopTLS.FindStringSubmatch(raw); len(m) == 2 {
			hop.TLSInfo = m[1]
		}
		hops = append(hops, hop)
	}
	return hops
}

func GetStorageBreakdown(sess *profilemgr.Session) StorageBreakdown {
	pDir := sess.ProfileDir
	dbBytes := fileSize(filepath.Join(pDir, "mail.db")) +
		fileSize(filepath.Join(pDir, "mail.db-wal")) +
		fileSize(filepath.Join(pDir, "mail.db-shm"))
	rawBytes := dirSize(filepath.Join(pDir, "blobs", "raw"))
	attBytes := dirSize(filepath.Join(pDir, "blobs", "attachments"))
	otherBytes := dirSize(filepath.Join(pDir, "logs")) + dirSize(filepath.Join(pDir, "exports"))
	free := queryFreeDiskBytes(pDir)
	return StorageBreakdown{
		ProfileDir:          pDir,
		DatabaseBytes:       dbBytes,
		RawMessagesBytes:    rawBytes,
		AttachmentsBytes:    attBytes,
		LogsAndExportsBytes: otherBytes,
		TotalUsedBytes:      dbBytes + rawBytes + attBytes + otherBytes,
		DiskFreeBytes:       free,
	}
}

func ClearAttachmentCache(sess *profilemgr.Session) (int64, error) {
	attDir := filepath.Join(sess.ProfileDir, "blobs", "attachments")
	freed := dirSize(attDir)
	_ = os.RemoveAll(attDir)
	_ = os.MkdirAll(attDir, 0o700)
	_, _ = sess.DB.Exec(`
		UPDATE attachments SET status='remote', blob_sha256='', local_path=''
		WHERE is_inline = 0 AND status = 'ready'
	`)
	_, _ = sess.DB.Exec(`PRAGMA optimize`)
	return freed, nil
}

// ExportDiagnosticBundle 导出严格脱敏的 .zip 诊断包（绝不打包 secrets.vault 或邮件正文）。
func ExportDiagnosticBundle(sess *profilemgr.Session, outZipPath string) (string, error) {
	if strings.TrimSpace(outZipPath) == "" {
		expDir := filepath.Join(sess.ProfileDir, "exports")
		_ = os.MkdirAll(expDir, 0o700)
		outZipPath = filepath.Join(expDir, fmt.Sprintf("omnimail-diag-%s.zip", time.Now().Format("20060102-150405")))
	}
	f, err := os.OpenFile(outZipPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return "", err
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	accs, _ := accounts.List(sess.DB, nil)
	type maskedAcc struct {
		Provider string `json:"provider"`
		Masked   string `json:"maskedEmail"`
		Status   string `json:"status"`
		Error    string `json:"lastError"`
	}
	var mAccs []maskedAcc
	for _, a := range accs {
		mAccs = append(mAccs, maskedAcc{
			Provider: a.Provider,
			Masked:   security.MaskEmail(a.Email),
			Status:   a.Status,
			Error:    security.RedactSensitive(a.LastError),
		})
	}
	sysInfo, _ := json.MarshalIndent(map[string]any{
		"generatedAt": time.Now().Format(time.RFC3339),
		"os":          runtime.GOOS,
		"arch":        runtime.GOARCH,
		"goVersion":   runtime.Version(),
		"wails":       "v3.1.0",
		"accounts":    mAccs,
		"storage":     GetStorageBreakdown(sess),
	}, "", "  ")
	if w, wErr := zw.Create("system-summary.json"); wErr == nil {
		_, _ = w.Write(sysInfo)
	}

	logs, _ := ListSyncLogs(sess.DB, SyncLogFilter{Limit: 500})
	if w, wErr := zw.Create("sync-logs-redacted.log"); wErr == nil {
		for _, l := range logs {
			line := fmt.Sprintf("[%s] [%s] [%s/%s] (%dms) %s | %s\n",
				l.TimeText, l.Level, l.Protocol, l.Stage, l.DurationMs,
				security.RedactSensitive(l.Message), security.RedactSensitive(l.Detail))
			_, _ = w.Write([]byte(line))
		}
	}
	if err := zw.Close(); err != nil {
		return "", err
	}
	return outZipPath, nil
}
