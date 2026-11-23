package rules

import (
	"database/sql"
	"strings"
	"time"

	"omnimail/internal/config"
	"omnimail/internal/contacts"
	"omnimail/internal/mailproto"
	"omnimail/internal/outbox"
	"omnimail/internal/profilemgr"
)

// ShouldSendAutoReply 执行严格 RFC3834 防循环、范围与 96 小时频控判定。
func ShouldSendAutoReply(
	db *sql.DB,
	cfg config.AutoReplyConfig,
	accountID, selfEmail string,
	parsed *mailproto.ParsedEmail,
	finalFolder string,
	now time.Time,
) bool {
	if !cfg.Enabled || parsed == nil || finalFolder != "inbox" {
		return false
	}
	if cfg.AccountID != "" && cfg.AccountID != "all" && cfg.AccountID != accountID {
		return false
	}
	if !withinDateRange(cfg.StartTime, cfg.EndTime, now) {
		return false
	}
	sender := strings.ToLower(strings.TrimSpace(parsed.Sender.Email))
	if sender == "" || strings.EqualFold(sender, selfEmail) || contacts.IsAutomatedAddress(sender) {
		return false
	}
	if hasLoopOrBulkHeaders(parsed.RawHeaders) {
		return false
	}
	if cfg.ContactsAndSameDomainOnly && !isKnownContactOrSameDomain(db, sender, selfEmail) {
		return false
	}
	if cfg.LimitOncePer4Days {
		var lastMs int64
		if db.QueryRow(`SELECT last_replied_at FROM auto_reply_sent_log WHERE account_id=? AND sender_email=?`,
			accountID, sender).Scan(&lastMs) == nil {
			if now.Sub(time.UnixMilli(lastMs)) < 96*time.Hour {
				return false
			}
		}
	}
	return true
}

func MaybeSendAutoReply(
	sess *profilemgr.Session,
	sched *outbox.Scheduler,
	accountID, selfEmail string,
	parsed *mailproto.ParsedEmail,
	finalFolder string,
) bool {
	if sess == nil || sched == nil {
		return false
	}
	settings := config.LoadProfileSettings(sess.ProfileDir)
	now := time.Now()
	if !ShouldSendAutoReply(sess.DB, settings.AutoReply, accountID, selfEmail, parsed, finalFolder, now) {
		return false
	}

	var senderName string
	_ = sess.DB.QueryRow(`SELECT COALESCE(NULLIF(sender_name,''), name) FROM accounts WHERE id=?`, accountID).Scan(&senderName)
	subj := strings.TrimSpace(settings.AutoReply.Subject)
	if subj == "" {
		subj = "[自动回复] " + parsed.Subject
	}
	sender := strings.ToLower(strings.TrimSpace(parsed.Sender.Email))
	_, err := sched.EnqueueDirect(sess, accountID, mailproto.BuildMessageInput{
		FromName:  senderName,
		FromEmail: selfEmail,
		To:        []string{sender},
		Subject:   subj,
		BodyText:  settings.AutoReply.Body,
		InReplyTo: parsed.RFCMessageID,
		ExtraHeaders: map[string]string{
			"Auto-Submitted":           "auto-replied",
			"X-Auto-Response-Suppress": "All",
			"Precedence":               "auto_reply",
		},
	})
	if err != nil {
		return false
	}

	nowMs := now.UnixMilli()
	_, _ = sess.DB.Exec(`
		INSERT INTO auto_reply_sent_log(account_id, sender_email, last_replied_at)
		VALUES (?, ?, ?)
		ON CONFLICT(account_id, sender_email) DO UPDATE SET last_replied_at=excluded.last_replied_at
	`, accountID, sender, nowMs)
	settings.AutoReply.RepliedCount++
	_ = config.SaveProfileSettings(sess.ProfileDir, settings)
	return true
}

func hasLoopOrBulkHeaders(rawHeaders string) bool {
	for _, line := range strings.Split(strings.ReplaceAll(rawHeaders, "\r\n", "\n"), "\n") {
		colon := strings.IndexByte(line, ':')
		if colon <= 0 {
			continue
		}
		k := strings.ToLower(strings.TrimSpace(line[:colon]))
		v := strings.ToLower(strings.TrimSpace(line[colon+1:]))
		switch k {
		case "auto-submitted":
			if v != "" && v != "no" {
				return true
			}
		case "precedence":
			if strings.Contains(v, "bulk") || strings.Contains(v, "list") || strings.Contains(v, "junk") || strings.Contains(v, "auto_reply") {
				return true
			}
		case "list-id", "list-unsubscribe", "x-auto-response-suppress":
			if v != "" {
				return true
			}
		}
	}
	return false
}

func isKnownContactOrSameDomain(db *sql.DB, sender, selfEmail string) bool {
	sAt, mAt := strings.LastIndexByte(sender, '@'), strings.LastIndexByte(selfEmail, '@')
	if sAt > 0 && mAt > 0 && strings.EqualFold(sender[sAt+1:], selfEmail[mAt+1:]) {
		return true
	}
	var cnt int
	_ = db.QueryRow(`SELECT COUNT(1) FROM contacts WHERE LOWER(email)=? AND is_blocked=0`, sender).Scan(&cnt)
	return cnt > 0
}

func withinDateRange(startStr, endStr string, now time.Time) bool {
	parseFlex := func(s string) (time.Time, bool) {
		s = strings.TrimSpace(s)
		for _, layout := range []string{"2006-01-02 15:04", "2006-01-02", time.RFC3339} {
			if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
				return t, true
			}
		}
		return time.Time{}, false
	}
	if st, ok := parseFlex(startStr); ok && now.Before(st) {
		return false
	}
	if et, ok := parseFlex(endStr); ok {
		if len(strings.TrimSpace(endStr)) == 10 {
			et = et.Add(24*time.Hour - time.Second)
		}
		if now.After(et) {
			return false
		}
	}
	return true
}
