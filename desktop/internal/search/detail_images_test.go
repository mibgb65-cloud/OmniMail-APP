package search

import (
	"strings"
	"testing"

	"omnimail/internal/storage"
)

func TestRemoteImagesPolicyMatchesRenderedThread(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	_, err = db.Exec(`
		INSERT INTO accounts (id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc','Test','Test','me@example.com','imap','IMAP','password','imap.example.com',993,'SSL/TLS','smtp.example.com',465,'SSL/TLS',1);
		INSERT INTO threads (id,account_id,subject,last_msg_at) VALUES ('thread','acc','测试',3);
	`)
	if err != nil {
		t.Fatal(err)
	}
	const remoteSrc = `src="https://example.com/pixel.png"`
	const sanitized = `<img data-omnimail-` + remoteSrc + `>`
	for _, msg := range []struct {
		id, security  string
		time, allowed int
	}{
		{"regular", "", 1, 0},
		{"danger", `{"level":"danger"}`, 2, 1},
		{"allowed", "", 3, 1},
	} {
		_, err := db.Exec(`
			INSERT INTO messages (id,account_id,thread_id,folder,body_html_sanitized,sent_at,received_at,has_remote_images,remote_images_allowed,security_json)
			VALUES (?,'acc','thread','inbox',?,?,?,1,?,?)`,
			msg.id, sanitized, msg.time, msg.time, msg.allowed, msg.security)
		if err != nil {
			t.Fatal(err)
		}
	}

	for _, tc := range []struct {
		name, id string
		block    bool
		allowed  bool
	}{
		{"默认拦截", "regular", true, false},
		{"全局允许", "regular", false, true},
		{"单封允许", "allowed", true, true},
		{"高风险强制拦截", "danger", false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, includeThread := range []bool{false, true} {
				detail, err := GetMessageItem(db, tc.id, includeThread, tc.block)
				if err != nil {
					t.Fatal(err)
				}
				if !detail.HasRemoteImages || detail.RemoteImagesAllowed != tc.allowed {
					t.Fatalf("实际图片策略为 %v，应为 %v", detail.RemoteImagesAllowed, tc.allowed)
				}
				expected, found := 1, false
				if includeThread {
					expected = 3
				}
				if len(detail.Messages) != expected {
					t.Fatalf("邮件条数为 %d，应为 %d", len(detail.Messages), expected)
				}
				for _, msg := range detail.Messages {
					rendered := strings.Contains(msg.BodyHTML, "<img "+remoteSrc)
					if msg.ID == tc.id {
						found = true
						if rendered != tc.allowed {
							t.Fatal("正文与图片策略不一致")
						}
					}
					if msg.ID == "danger" && rendered {
						t.Fatal("会话中的高风险邮件不应加载远程图片")
					}
				}
				if !found {
					t.Fatal("结果缺少所选邮件")
				}
			}
		})
	}
}
