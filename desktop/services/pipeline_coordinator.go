package services

import (
	"database/sql"
	"encoding/json"
	"sync"

	"omnimail/internal/config"
	"omnimail/internal/contacts"
	"omnimail/internal/mailproto"
	"omnimail/internal/outbox"
	"omnimail/internal/profilemgr"
	"omnimail/internal/rules"
	"omnimail/internal/security"
	"omnimail/internal/syncer"
)

type MailPipelineCoordinator struct {
	mgr      *profilemgr.Manager
	sched    *outbox.Scheduler
	mu       sync.Mutex
	onNotify func(mailID, sender, subject, accountTag string)
	lastHits map[string][]string
}

func NewMailPipelineCoordinator(mgr *profilemgr.Manager, sched *outbox.Scheduler) *MailPipelineCoordinator {
	return &MailPipelineCoordinator{
		mgr:      mgr,
		sched:    sched,
		lastHits: make(map[string][]string),
	}
}

func (p *MailPipelineCoordinator) SetNotifier(fn func(mailID, sender, subject, accountTag string)) {
	p.mu.Lock()
	p.onNotify = fn
	p.mu.Unlock()
}

func (p *MailPipelineCoordinator) BeforeMessageInsert(
	tx *sql.Tx,
	accountID, accountEmail string,
	parsed *mailproto.ParsedEmail,
	defaultFolder string,
) syncer.PreIngestDecision {
	var dec syncer.PreIngestDecision
	if parsed == nil {
		return dec
	}

	settings := config.DefaultAppSettings()
	if sess, err := p.mgr.ActiveSession(); err == nil {
		settings = config.LoadProfileSettings(sess.ProfileDir)
	}

	// 1. 黑名单前置拦截（最高优先级）
	blocked := false
	if defaultFolder == "inbox" && contacts.CheckAndCountBlocked(tx, parsed.Sender.Email) {
		blocked = true
		dec.OverrideFolder = "spam"
		dec.MarkRead = true
		dec.SuppressNotify = true
	}

	// 2. 本地零外网钓鱼与身份认证启发式检测
	if settings.PhishingCheckEnabled && defaultFolder != "sent" && defaultFolder != "drafts" {
		var rtEmails, attExts, attNames []string
		for _, rt := range parsed.ReplyTo {
			rtEmails = append(rtEmails, rt.Email)
		}
		for _, a := range parsed.Attachments {
			attExts = append(attExts, a.Ext)
			attNames = append(attNames, a.Filename)
		}
		if warn := security.EvaluatePhishing(security.PhishingCheckInput{
			SenderName:      parsed.Sender.Name,
			SenderEmail:     parsed.Sender.Email,
			ReplyToEmails:   rtEmails,
			RawHeaders:      parsed.RawHeaders,
			BodyHTML:        parsed.BodyHTML,
			AttachmentExts:  attExts,
			AttachmentNames: attNames,
		}); warn != nil {
			b, _ := json.Marshal(warn)
			dec.SecurityJSON = string(b)
		}
	}

	// 3. .ics 日程邀请解析与本地冲突检测
	if parsed.RawICS != "" {
		if inv, err := mailproto.ParseICSInvite(parsed.RawICS, parsed.ICSFilename, accountEmail, parsed.BodyText); err == nil && inv != nil {
			mailproto.CheckAndUpsertCalendarConflict(tx, accountID, "", inv)
			b, _ := json.Marshal(inv)
			dec.MeetingJSON = string(b)
		}
	}

	// 4. 本地自动化规则引擎（仅对首次同步进入收件箱且未命中黑名单的邮件生效）
	if defaultFolder == "inbox" && !blocked {
		outcome := rules.EvaluateOnIncoming(tx, accountID, parsed)
		if outcome.OverrideFolder != "" {
			dec.OverrideFolder = outcome.OverrideFolder
		}
		if outcome.MarkRead {
			dec.MarkRead = true
		}
		if outcome.MarkStarred {
			dec.MarkStarred = true
		}
		dec.AddLabelIDs = outcome.AddLabelIDs
		if len(outcome.HitRuleIDs) > 0 && parsed.RFCMessageID != "" {
			p.mu.Lock()
			p.lastHits[parsed.RFCMessageID] = outcome.HitRuleIDs
			p.mu.Unlock()
		}
	}
	return dec
}

func (p *MailPipelineCoordinator) AfterMessageCommit(
	db *sql.DB,
	accountID, accountEmail, msgID, finalFolder string,
	parsed *mailproto.ParsedEmail,
	isNew bool,
	suppressNotify bool,
) {
	if parsed == nil {
		return
	}
	contacts.ExtractFromMessage(db, accountID, accountEmail, parsed)

	if parsed.RFCMessageID != "" {
		p.mu.Lock()
		hits := p.lastHits[parsed.RFCMessageID]
		delete(p.lastHits, parsed.RFCMessageID)
		p.mu.Unlock()
		if len(hits) > 0 {
			rules.RecordRuleHits(db, msgID, hits)
		}
	}

	sess, err := p.mgr.ActiveSession()
	if err != nil {
		return
	}
	if isNew && finalFolder == "inbox" {
		rules.MaybeSendAutoReply(sess, p.sched, accountID, accountEmail, parsed, finalFolder)
	}
	if isNew && finalFolder == "inbox" && !suppressNotify {
		settings := config.LoadProfileSettings(sess.ProfileDir)
		if settings.ShowDesktopNotifications {
			p.mu.Lock()
			notifyFn := p.onNotify
			p.mu.Unlock()
			if notifyFn != nil {
				var shortTag string
				_ = db.QueryRow(`SELECT short_tag FROM accounts WHERE id=?`, accountID).Scan(&shortTag)
				sender := parsed.Sender.Name
				if sender == "" {
					sender = parsed.Sender.Email
				}
				notifyFn(msgID, sender, parsed.Subject, shortTag)
			}
		}
	}
}
