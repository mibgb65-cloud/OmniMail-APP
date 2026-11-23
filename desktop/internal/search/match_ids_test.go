package search

import (
	"reflect"
	"testing"

	"omnimail/internal/storage"
)

func TestMatchMailIDsUsesCurrentListFilters(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	if _, err := db.Exec(`
		INSERT INTO accounts (id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-a','A','A','a@example.com','imap','IMAP','password','imap.example.com',993,'SSL/TLS','smtp.example.com',465,'SSL/TLS',1),
		       ('acc-b','B','B','b@example.com','imap','IMAP','password','imap.example.com',993,'SSL/TLS','smtp.example.com',465,'SSL/TLS',1);
		INSERT INTO threads (id,account_id,subject,last_msg_at) VALUES ('thread-a','acc-a','测试',3), ('thread-b','acc-b','测试',3);
		INSERT INTO messages (id,account_id,thread_id,folder,sender_email,is_unread,has_attachments,sent_at,received_at)
		VALUES ('eligible','acc-a','thread-a','inbox','sender@example.com',1,1,1,4),
		       ('other-account','acc-b','thread-b','inbox','sender@example.com',1,1,1,3),
		       ('read','acc-a','thread-a','inbox','sender@example.com',0,1,1,2),
		       ('old','acc-a','thread-a','inbox','sender@example.com',1,1,1,1),
		       ('archived','acc-a','thread-a','archive','sender@example.com',1,1,1,5);
		INSERT INTO message_labels (message_id,label_id) VALUES ('eligible','lbl-work'), ('other-account','lbl-work'), ('old','lbl-review');
	`); err != nil {
		t.Fatal(err)
	}
	ids := []string{"eligible", "eligible", "other-account", "read", "archived", "missing"}
	query := MailSearchQuery{AccountIDs: []string{"acc-a"}, Folder: "inbox", Tab: "unread"}
	matched, err := MatchMailIDs(db, query, ids)
	if err != nil || !reflect.DeepEqual(matched, []string{"eligible"}) {
		t.Fatalf("新邮件必须符合选中邮箱、文件夹和未读筛选：%v, %v", matched, err)
	}
	query.LabelIDs = []string{"lbl-work"}
	query.From = "sender@example.com"
	matched, err = MatchMailIDs(db, query, ids)
	if err != nil || !reflect.DeepEqual(matched, []string{"eligible"}) {
		t.Fatalf("新邮件必须符合标签和发件人筛选：%v, %v", matched, err)
	}
	query.From = "not-sender"
	matched, err = MatchMailIDs(db, query, ids)
	if err != nil || len(matched) != 0 {
		t.Fatalf("不匹配搜索条件的邮件不应计数：%v, %v", matched, err)
	}
	if _, err := MatchMailIDs(db, query, make([]string, 201)); err == nil {
		t.Fatal("单批新增邮件 ID 必须有数量上限")
	}
}
