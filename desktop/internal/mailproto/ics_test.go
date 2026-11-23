package mailproto_test

import (
	"strings"
	"testing"

	"omnimail/internal/mailproto"
	"omnimail/internal/storage"
)

func TestICSParserConflictDetectionAndReply(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	_, _ = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-1','Work','工作','me@corp.com','imap','IMAP','password','imap.corp.com',993,'SSL/TLS','smtp.corp.com',465,'SSL/TLS',1000)`)

	ics1 := strings.Join([]string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"METHOD:REQUEST",
		"BEGIN:VEVENT",
		"UID:evt-1001@corp.com",
		"SEQUENCE:1",
		"DTSTART:20261125T060000Z",
		"DTEND:20261125T070000Z",
		"SUMMARY:架构评审会议",
		"LOCATION:https://meet.google.com/abc-defg-hij",
		"ORGANIZER;CN=Lead:mailto:lead@corp.com",
		"ATTENDEE;CN=Me;PARTSTAT=ACCEPTED:mailto:me@corp.com",
		"END:VEVENT",
		"END:VCALENDAR",
	}, "\r\n")

	inv1, err := mailproto.ParseICSInvite(ics1, "invite1.ics", "me@corp.com", "")
	if err != nil || inv1 == nil {
		t.Fatalf("ParseICSInvite 1 failed: %v", err)
	}
	if inv1.Title != "架构评审会议" || !strings.Contains(inv1.MeetingLink, "meet.google.com") {
		t.Fatalf("unexpected parsed invite 1: %+v", inv1)
	}
	mailproto.CheckAndUpsertCalendarConflict(db, "acc-1", "m-1", inv1)
	if inv1.ConflictStatus != "free" {
		t.Fatalf("first event should be free, got %s", inv1.ConflictStatus)
	}

	// 第二场重叠时间段的会议邀请必须精确识别出 conflict
	ics2 := strings.ReplaceAll(ics1, "UID:evt-1001@corp.com", "UID:evt-1002@corp.com")
	ics2 = strings.ReplaceAll(ics2, "SUMMARY:架构评审会议", "SUMMARY:客户紧急沟通")
	ics2 = strings.ReplaceAll(ics2, "PARTSTAT=ACCEPTED", "PARTSTAT=NEEDS-ACTION")
	inv2, err := mailproto.ParseICSInvite(ics2, "invite2.ics", "me@corp.com", "")
	if err != nil || inv2 == nil {
		t.Fatalf("ParseICSInvite 2 failed: %v", err)
	}
	mailproto.CheckAndUpsertCalendarConflict(db, "acc-1", "m-2", inv2)
	if inv2.ConflictStatus != "conflict" || !strings.Contains(inv2.ConflictHint, "架构评审会议") {
		t.Fatalf("expected conflict with 架构评审会议, got %+v", inv2)
	}

	replyICS := mailproto.BuildICSReplyPayload(*inv2, "Me", "me@corp.com", "accepted")
	if !strings.Contains(replyICS, "METHOD:REPLY") || !strings.Contains(replyICS, "PARTSTAT=ACCEPTED") {
		t.Fatalf("invalid METHOD:REPLY payload: %s", replyICS)
	}
}
