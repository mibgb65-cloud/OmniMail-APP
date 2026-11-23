package rules

import (
	"testing"
	"time"

	"omnimail/internal/config"
	"omnimail/internal/mailproto"
	"omnimail/internal/storage"
)

func TestRuleEnginePriorityPreviewAndVacationLoopPrevention(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	_, _ = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-1','Work','工作','me@corp.com','imap','IMAP','password','imap.corp.com',993,'SSL/TLS','smtp.corp.com',465,'SSL/TLS',1000)`)

	// 1. 高优先级规则 stopMatching 阻断低优先级规则
	r1, err := SaveRule(db, InboxRuleDTO{
		Name: "财务发票自动归档", Enabled: true, Priority: 10, MatchMode: "AND", AccountScope: "all",
		ConditionField: "subject", ConditionOperator: "contains", ConditionValue: "发票",
		AttachmentExt: ".pdf", ActionType: "archive", StopMatching: true,
	})
	if err != nil {
		t.Fatalf("SaveRule r1: %v", err)
	}
	_, err = SaveRule(db, InboxRuleDTO{
		Name: "低优先级移入回收站", Enabled: true, Priority: 20, MatchMode: "AND", AccountScope: "all",
		ConditionField: "subject", ConditionOperator: "contains", ConditionValue: "发票",
		ActionType: "delete",
	})
	if err != nil {
		t.Fatalf("SaveRule r2: %v", err)
	}

	tx, _ := db.Begin()
	out := EvaluateOnIncoming(tx, "acc-1", &mailproto.ParsedEmail{
		Sender:      mailproto.EmailAddress{Email: "billing@vendor.com"},
		Subject:     "2026年11月电子发票",
		Attachments: []mailproto.ParsedAttachment{{Filename: "inv.pdf", Ext: "pdf"}},
	})
	_ = tx.Commit()
	if out.OverrideFolder != "archive" || len(out.HitRuleIDs) != 1 || out.HitRuleIDs[0] != r1.ID {
		t.Fatalf("expected archive with stop_matching stopping r2, got %+v", out)
	}
	RecordRuleHits(db, "m-1", out.HitRuleIDs)
	listed, _ := ListRules(db)
	if len(listed) == 0 || listed[0].HitsLast7Days != 1 {
		t.Fatalf("expected hitsLast7Days=1, got %+v", listed)
	}

	// 2. 干跑预览 (Dry-Run)
	nowMs := time.Now().UnixMilli()
	_, _ = db.Exec(`INSERT INTO threads(id,account_id,subject,snippet,last_msg_at) VALUES ('t1','acc-1','周报','hi',?)`, nowMs)
	_, _ = db.Exec(`INSERT INTO messages(id,account_id,thread_id,folder,sender_name,sender_email,subject,body_text,sent_at,received_at)
		VALUES ('m-p1','acc-1','t1','inbox','Boss','boss@corp.com','研发周报汇总','请审阅',?,?)`, nowMs, nowMs)
	prev, err := PreviewRule(db, InboxRuleDTO{ConditionField: "subject", ConditionOperator: "contains", ConditionValue: "周报", ActionType: "star"})
	if err != nil || prev.HitCount != 1 {
		t.Fatalf("PreviewRule expected 1 hit, got %+v, err=%v", prev, err)
	}

	// 3. RFC3834 休假自动回复防死循环与 96 小时频控测试
	now := time.Now()
	cfg := config.AutoReplyConfig{
		Enabled:                   true,
		AccountID:                 "all",
		StartTime:                 now.Add(-24 * time.Hour).Format("2006-01-02"),
		EndTime:                   now.Add(24 * time.Hour).Format("2006-01-02"),
		ContactsAndSameDomainOnly: false,
		LimitOncePer4Days:         true,
	}

	// 自身发信、Auto-Submitted、List-Unsubscribe、noreply 必须全部跳过
	loopCases := []*mailproto.ParsedEmail{
		{Sender: mailproto.EmailAddress{Email: "me@corp.com"}, Subject: "Self"},
		{Sender: mailproto.EmailAddress{Email: "noreply@github.com"}, Subject: "Alert"},
		{Sender: mailproto.EmailAddress{Email: "peer@ext.com"}, RawHeaders: "Auto-Submitted: auto-replied\r\n"},
		{Sender: mailproto.EmailAddress{Email: "news@ext.com"}, RawHeaders: "Precedence: bulk\r\nList-Unsubscribe: <mailto:u@ext.com>\r\n"},
	}
	for i, tc := range loopCases {
		if ShouldSendAutoReply(db, cfg, "acc-1", "me@corp.com", tc, "inbox", now) {
			t.Fatalf("case %d should have been blocked by RFC3834 loop filter", i)
		}
	}

	// 正常外部真人邮件首次应允许，写入 96h 日志后第二次必须拦截
	humanMail := &mailproto.ParsedEmail{Sender: mailproto.EmailAddress{Email: "client@ext.com"}, Subject: "Hello"}
	if !ShouldSendAutoReply(db, cfg, "acc-1", "me@corp.com", humanMail, "inbox", now) {
		t.Fatal("expected human mail to trigger auto-reply")
	}
	_, _ = db.Exec(`INSERT INTO auto_reply_sent_log(account_id, sender_email, last_replied_at) VALUES ('acc-1', 'client@ext.com', ?)`, now.UnixMilli())
	if ShouldSendAutoReply(db, cfg, "acc-1", "me@corp.com", humanMail, "inbox", now.Add(2*time.Hour)) {
		t.Fatal("expected 96-hour rate limiter to suppress duplicate auto-reply")
	}
}
