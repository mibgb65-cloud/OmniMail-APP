package mailproto

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"golang.org/x/text/encoding/simplifiedchinese"

	"omnimail/internal/storage"
)

func TestParseMultipartGBKAndFilenameSanitization(t *testing.T) {
	gbkBody, err := simplifiedchinese.GB18030.NewEncoder().Bytes([]byte("你好，这是 GB18030 编码的中文采购合同正文。"))
	if err != nil {
		t.Fatal(err)
	}
	var raw bytes.Buffer
	raw.WriteString("From: =?GBK?B?1tDOxA==?= <sender@163.com>\r\n")
	raw.WriteString("To: buyer@company.com\r\n")
	raw.WriteString("Subject: =?GBK?B?1tDOxA==?= Contract\r\n")
	raw.WriteString("Message-ID: <msg-gbk-1@163.com>\r\n")
	raw.WriteString("MIME-Version: 1.0\r\n")
	raw.WriteString("Content-Type: multipart/mixed; boundary=\"BOUND1\"\r\n\r\n")
	raw.WriteString("--BOUND1\r\n")
	raw.WriteString("Content-Type: text/plain; charset=\"gb2312\"\r\n\r\n")
	raw.Write(gbkBody)
	raw.WriteString("\r\n--BOUND1\r\n")
	raw.WriteString("Content-Type: application/pdf\r\n")
	raw.WriteString("Content-Disposition: attachment; filename=\"../../evil\\invoice?.pdf\"\r\n\r\n")
	raw.WriteString("%PDF-1.4 mock\r\n--BOUND1--\r\n")

	parsed, err := ParseRawMessage(raw.Bytes())
	if err != nil {
		t.Fatalf("ParseRawMessage 失败: %v", err)
	}
	if !strings.Contains(parsed.BodyText, "中文采购合同正文") {
		t.Fatalf("GB2312/GB18030 正文解码乱码: %q", parsed.BodyText)
	}
	if len(parsed.Attachments) != 1 || strings.Contains(parsed.Attachments[0].Filename, "..") || strings.Contains(parsed.Attachments[0].Filename, "?") {
		t.Fatalf("附件名路径穿越清洗不完整: %+v", parsed.Attachments)
	}
}

func TestThreeLevelThreadGrouping(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	_, err = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('a1','Acc','A','me@example.com','imap','IMAP','imap','imap.example.com',993,'SSL/TLS','smtp.example.com',465,'SSL/TLS',1)`)
	if err != nil {
		t.Fatal(err)
	}

	nowMs := time.Now().UnixMilli()
	tx1, _ := db.Begin()
	tid1, err := ResolveOrCreateThread(tx1, ThreadMatchInput{
		AccountID: "a1", RFCMessageID: "root-1@ex", Subject: "架构设计评审会议",
		SenderEmail: "alice@ex", Participants: []string{"me@example.com"}, ReceivedAtMs: nowMs,
	}, "初版方案")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = tx1.Exec(`INSERT INTO messages(id,account_id,thread_id,rfc_message_id,folder,sender_email,to_json,subject,snippet,sent_at,received_at)
		VALUES ('m1','a1',?,'root-1@ex','inbox','alice@ex','[{"email":"me@example.com"}]','架构设计评审会议','初版方案',?,?)`, tid1, nowMs, nowMs)
	_ = tx1.Commit()

	// 级别 1：精确 References 命中
	tx2, _ := db.Begin()
	tidRef, _ := ResolveOrCreateThread(tx2, ThreadMatchInput{
		AccountID: "a1", RFCMessageID: "reply-2@ex", References: []string{"<root-1@ex>"},
		Subject: "完全改了标题但带引用头", SenderEmail: "me@example.com", ReceivedAtMs: nowMs + 1000,
	}, "回复")
	_ = tx2.Commit()
	if tidRef != tid1 {
		t.Fatalf("精确 References 未归并到同一会话: got=%s want=%s", tidRef, tid1)
	}

	// 级别 2：无引用头，但 14 天内中文「回复：」规范化主题一致且有共同参与者
	tx3, _ := db.Begin()
	tidSub, _ := ResolveOrCreateThread(tx3, ThreadMatchInput{
		AccountID: "a1", RFCMessageID: "sub-3@ex", Subject: "回复：Re: 架构设计评审会议",
		SenderEmail: "alice@ex", Participants: []string{"me@example.com"}, ReceivedAtMs: nowMs + 60000,
	}, "补充")
	_ = tx3.Commit()
	if tidSub != tid1 {
		t.Fatalf("规范化中文主题未归并到同一会话: got=%s want=%s", tidSub, tid1)
	}
}
