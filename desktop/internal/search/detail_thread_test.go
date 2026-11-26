package search

import (
	"strings"
	"testing"

	"omnimail/internal/storage"
)

func TestGetMessageItemRewritesLegacyColorSchemeAndDedupsGmailAllMail(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	_, err = db.Exec(`
		INSERT INTO accounts (id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-g','Gmail','G','user@gmail.com','gmail','Gmail','oauth2','imap.gmail.com',993,'SSL/TLS','smtp.gmail.com',465,'SSL/TLS',1);
		INSERT INTO threads (id,account_id,subject,last_msg_at)
		VALUES ('th-dup','acc-g','Linux.do Topic Reply',2000);
	`)
	if err != nil {
		t.Fatal(err)
	}

	legacyHTML := `<style>.mail-html-inner { background: #ffffff; } @media (prefers-color-scheme: dark) { .mail-html-inner { background: #151515 !important } p, td { color: inherit !important } }</style><p>Hello Linux.do</p>`

	// 先插入 [Gmail]/All Mail (archive) 记录，再插入 INBOX 记录（模拟同步顺序不确定）
	_, err = db.Exec(`
		INSERT INTO messages (id,account_id,thread_id,rfc_message_id,raw_blob_sha256,folder,sender_name,sender_email,to_json,subject,body_text,body_html_sanitized,sent_at,received_at)
		VALUES
		  ('msg-archive','acc-g','th-dup','<topic-101@linux.do>','sha-same-101','archive','Discourse','noreply@linux.do','[]','Linux.do Topic Reply','Hello Linux.do',?,1000,1001),
		  ('msg-inbox','acc-g','th-dup','  <TOPIC-101@linux.do> ','sha-same-101','inbox','Discourse','noreply@linux.do','[]','Linux.do Topic Reply','Hello Linux.do',?,1000,1002),
		  ('msg-second-arch','acc-g','th-dup','','sha-only-202','archive','Alice','alice@example.com','[]','Re: Linux.do Topic Reply','Second reply','<p>Second</p>',2000,2001),
		  ('msg-second-sent','acc-g','th-dup','','sha-only-202','sent','Alice','alice@example.com','[]','Re: Linux.do Topic Reply','Second reply','<p>Second</p>',2000,2002);
	`, legacyHTML, legacyHTML)
	if err != nil {
		t.Fatal(err)
	}

	// 1) 打开 msg-inbox：会话中 4 条记录应按 rfc_message_id / raw_blob_sha256 去重为 2 条，分别保留 inbox 与 sent，且最后一条展开
	gotInbox, err := GetMessageItem(db, "msg-inbox", true, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(gotInbox.Messages) != 2 {
		t.Fatalf("expected 2 deduplicated thread messages, got %d: %+v", len(gotInbox.Messages), gotInbox.Messages)
	}
	if gotInbox.Messages[0].ID != "msg-inbox" || !gotInbox.Messages[0].Collapsed {
		t.Fatalf("expected first message to keep msg-inbox (collapsed=true), got %+v", gotInbox.Messages[0])
	}
	if gotInbox.Messages[1].ID != "msg-second-sent" || gotInbox.Messages[1].Collapsed {
		t.Fatalf("expected last message to keep msg-second-sent (collapsed=false), got %+v", gotInbox.Messages[1])
	}

	// 验证存量 prefers-color-scheme HTML 在读取渲染时即刻改写，无需重新拉取邮件
	rendered := gotInbox.Messages[0].BodyHTML
	if strings.Contains(strings.ToLower(rendered), "prefers-color-scheme") {
		t.Fatalf("legacy prefers-color-scheme was not rewritten on read: %s", rendered)
	}
	if !strings.Contains(rendered, `.mail-html-inner[data-theme="dark"][data-html-mode="adaptive"] { background: #151515 !important }`) {
		t.Fatalf("expected scoped dark adaptive rule on read, got: %s", rendered)
	}

	// 2) 若用户在归档视图直接点开 msg-archive：当前打开的 msgID 具有最高保留优先级
	gotArchive, err := GetMessageItem(db, "msg-archive", true, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(gotArchive.Messages) != 2 || gotArchive.Messages[0].ID != "msg-archive" {
		t.Fatalf("expected currently opened msg-archive to be preserved, got %+v", gotArchive.Messages)
	}
}
