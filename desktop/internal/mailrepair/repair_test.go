package mailrepair_test

import (
	"bytes"
	"strings"
	"testing"

	"golang.org/x/text/encoding/simplifiedchinese"

	"omnimail/internal/search"
	"omnimail/internal/storage"
)

func TestLegacyMailRepairFixesGarbledExmailAndNeteaseHTMLStyles(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	blobs := storage.NewBlobStore(dir)

	_, err = db.Exec(`
		INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-1','Work','工','me@corp.com','imap','IMAP','password','imap.corp.com',993,'SSL/TLS','smtp.corp.com',465,'SSL/TLS',1000);
		INSERT INTO threads(id,account_id,subject,snippet,last_msg_at,msg_count,unread_count)
		VALUES ('th-exmail','acc-1','异地登录提醒','提醒',1000,1,1),
		       ('th-netease','acc-1','新设备登录提醒','网易',1001,1,1);
	`)
	if err != nil {
		t.Fatal(err)
	}

	// 1. 构造历史已入库的腾讯企业邮畸形记录（裸 GB18030 + 尖括号未拆分 + 误报钓鱼 JSON + 畸形联系人）
	gbSender, _ := simplifiedchinese.GB18030.NewEncoder().Bytes([]byte("腾讯企业邮箱"))
	rawFrom := string(append(append([]byte(`<"`), gbSender...), []byte(`"><10000@exmail.weixin.qq.com>`)...))
	rawHdr := "From: " + rawFrom + "\r\nSubject: =?gb18030?B?08q12rXas8nM7MPD?=\r\nAuthentication-Results: mx.qq.com; spf=pass; dkim=pass; dmarc=pass\r\n"
	falseDangerJSON := `{"level":"danger","title":"高危钓鱼或欺诈邮件预警","detail":"发件人显示名伪装为其他域名邮箱（exmail.weixin.qq.com），与真实发件域不一致。","spf":"pass","dkim":"pass","dmarc":"pass"}`

	_, err = db.Exec(`
		INSERT INTO messages(id,account_id,thread_id,folder,sender_name,sender_email,to_json,cc_json,subject,snippet,body_text,body_html_sanitized,raw_headers,sent_at,received_at,security_json)
		VALUES ('msg-exmail','acc-1','th-exmail','inbox',?,?,'[]','[]','异地登录提醒','提醒','异地登录提醒','<p>异地登录提醒</p>',?,1000,1000,?);
		INSERT INTO messages_fts(message_id,subject,sender_name,sender_email,body_text,attachment_names)
		VALUES ('msg-exmail','异地登录提醒',?,?, '异地登录提醒','');
		INSERT INTO contacts(id,name,email,user_edited,mail_count,last_contact_at,updated_at)
		VALUES ('c-bad',?,?,0,3,1000,1000);
	`, rawFrom, strings.ToLower(rawFrom), rawHdr, falseDangerJSON, rawFrom, strings.ToLower(rawFrom), rawFrom, strings.ToLower(rawFrom))
	if err != nil {
		t.Fatal(err)
	}

	// 2. 构造历史已入库的网易 HTML 邮件（本地存有 .eml.zst，但旧版清洗剥离了 <style> 与 class）
	var neteaseEML bytes.Buffer
	neteaseEML.WriteString("From: 网易邮箱中心 <passport@service.netease.com>\r\n")
	neteaseEML.WriteString("Subject: 新设备登录提醒\r\n")
	neteaseEML.WriteString("MIME-Version: 1.0\r\nContent-Type: text/html; charset=\"utf-8\"\r\n\r\n")
	neteaseEML.WriteString(`<html><head><style>.edm-btn-desktop { display: none !important; }</style></head><body>` +
		`<img src="cid:logo@163.com"><img src="https://img.163.com/track.png">` +
		`<a class="edm-btn-webmail" href="https://reg.163.com">查看安全活动</a>` +
		`<a class="edm-btn-desktop" href="https://reg.163.com">桌面端查看</a></body></html>`)
	rawSHA, err := blobs.PutRawEML(neteaseEML.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`
		INSERT INTO messages(id,account_id,thread_id,folder,sender_name,sender_email,to_json,cc_json,subject,snippet,body_text,body_html_sanitized,raw_blob_sha256,raw_headers,sent_at,received_at,has_remote_images)
		VALUES ('msg-netease','acc-1','th-netease','inbox','网易邮箱中心','passport@service.netease.com','[]','[]','新设备登录提醒','提醒','提醒','<img src="/omnimail-cid/att-logo"><a>查看安全活动</a><a>桌面端查看</a>',?,'From: passport@service.netease.com',1001,1001,1);
		INSERT INTO attachments(id,message_id,filename,ext,mime_type,content_id,is_inline,status)
		VALUES ('att-logo','msg-netease','logo.png','png','image/png','<logo@163.com>',1,'ready');
	`, rawSHA)
	if err != nil {
		t.Fatal(err)
	}

	// 3. 调用详情读取自动触发存量修复并验证结果
	exmailItem, err := search.GetThreadDetail(db, "msg-exmail", true)
	if err != nil {
		t.Fatalf("GetThreadDetail exmail failed: %v", err)
	}
	if exmailItem.SenderName != "腾讯企业邮箱" || exmailItem.SenderEmail != "10000@exmail.weixin.qq.com" {
		t.Fatalf("expected repaired sender 腾讯企业邮箱 <10000@exmail.weixin.qq.com>, got %q <%s>", exmailItem.SenderName, exmailItem.SenderEmail)
	}
	if exmailItem.SecurityWarning != nil {
		t.Fatalf("expected false phishing warning cleared on legacy exmail, got %+v", exmailItem.SecurityWarning)
	}

	var cName, cEmail string
	if err := db.QueryRow(`SELECT name, email FROM contacts WHERE id='c-bad'`).Scan(&cName, &cEmail); err != nil {
		t.Fatalf("query repaired contact failed: %v", err)
	}
	if cName != "腾讯企业邮箱" || cEmail != "10000@exmail.weixin.qq.com" {
		t.Fatalf("expected repaired contact 腾讯企业邮箱 / 10000@exmail.weixin.qq.com, got %q / %q", cName, cEmail)
	}

	neteaseItem, err := search.GetThreadDetail(db, "msg-netease", true)
	if err != nil {
		t.Fatalf("GetThreadDetail netease failed: %v", err)
	}
	htmlOut := neteaseItem.Messages[0].BodyHTML
	if !strings.Contains(htmlOut, "<style>") || !strings.Contains(htmlOut, ".edm-btn-desktop { display: none !important }") || !strings.Contains(htmlOut, `class="edm-btn-desktop"`) {
		t.Fatalf("expected legacy NetEase HTML rebuilt with <style> and class, got: %s", htmlOut)
	}
	if !strings.Contains(htmlOut, `src="/omnimail-cid/att-logo"`) || !strings.Contains(htmlOut, `data-omnimail-src="https://img.163.com/track.png"`) {
		t.Fatalf("expected CID mapping and remote image blocking preserved after rebuild, got: %s", htmlOut)
	}
}

func TestLazyRebuildRestoresLegacyInstagramBackgroundImagesFromBlob(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	blobs := storage.NewBlobStore(dir)

	var igEML bytes.Buffer
	igEML.WriteString("From: Instagram <no-reply@mail.instagram.com>\r\n")
	igEML.WriteString("Subject: New posts\r\n")
	igEML.WriteString("MIME-Version: 1.0\r\nContent-Type: text/html; charset=\"utf-8\"\r\n\r\n")
	igEML.WriteString(`<html><head><style>.ig-wrap { width: 100%; }</style></head><body>` +
		`<table><tr><td style="background:url(https://scontent.cdninstagram.com/v/post1.jpg?oe=1&amp;oh=2) no-repeat center / cover; height:320px;"></td></tr></table>` +
		`</body></html>`)
	rawSHA, err := blobs.PutRawEML(igEML.Bytes())
	if err != nil {
		t.Fatal(err)
	}

	// 模拟存量邮件：此前已被写入含 <style> 但外链背景图被抹成 background:none 且无 data-omnimail-bg 的 HTML
	legacySanitized := `<style>.ig-wrap { width: 100% }</style><table><tbody><tr><td style="background:none no-repeat center / cover; height:320px;"></td></tr></tbody></table>`
	_, err = db.Exec(`
		INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-ig','IG','IG','me@example.com','imap','IMAP','password','imap.example.com',993,'SSL/TLS','smtp.example.com',465,'SSL/TLS',1000);
		INSERT INTO threads(id,account_id,subject,snippet,last_msg_at,msg_count,unread_count)
		VALUES ('th-ig','acc-ig','New posts','IG',2000,1,1);
		INSERT INTO messages(id,account_id,thread_id,folder,sender_name,sender_email,to_json,cc_json,subject,snippet,body_text,body_html_sanitized,raw_blob_sha256,raw_headers,sent_at,received_at,has_remote_images,remote_images_allowed)
		VALUES ('msg-ig','acc-ig','th-ig','inbox','Instagram','no-reply@mail.instagram.com','[]','[]','New posts','IG','IG',?,?, 'Authentication-Results: mx; spf=pass; dkim=pass; dmarc=pass',2000,2000,1,1);
	`, legacySanitized, rawSHA)
	if err != nil {
		t.Fatal(err)
	}

	// 1. 拦截态读取：触发从 .eml.zst 重建 data-omnimail-bg，但单封已允许(remote_images_allowed=1)或全局拦截验证
	_, _ = db.Exec(`UPDATE messages SET remote_images_allowed = 0 WHERE id = 'msg-ig'`)
	blockedItem, err := search.GetThreadDetail(db, "msg-ig", true)
	if err != nil {
		t.Fatalf("GetThreadDetail blocked failed: %v", err)
	}
	if strings.Contains(blockedItem.Messages[0].BodyHTML, "scontent.cdninstagram.com") && !strings.Contains(blockedItem.Messages[0].BodyHTML, "data-omnimail-bg=") {
		t.Fatalf("blocked mode must not expose live url(...): %s", blockedItem.Messages[0].BodyHTML)
	}
	if strings.Contains(blockedItem.Messages[0].BodyHTML, "url(") {
		t.Fatalf("blocked mode must not contain live url(...): %s", blockedItem.Messages[0].BodyHTML)
	}

	// 2. 放行态读取：无需重新拉取邮件，直接还原完整 Instagram 照片背景 URL
	allowedItem, err := search.GetThreadDetail(db, "msg-ig", false)
	if err != nil {
		t.Fatalf("GetThreadDetail allowed failed: %v", err)
	}
	gotHTML := allowedItem.Messages[0].BodyHTML
	if !strings.Contains(gotHTML, "https://scontent.cdninstagram.com/v/post1.jpg") || !strings.Contains(gotHTML, "no-repeat center / cover") {
		t.Fatalf("expected legacy Instagram background URL restored from .eml.zst, got: %s", gotHTML)
	}
}
