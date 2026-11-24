package search

import (
	"testing"

	"omnimail/internal/storage"
)

func TestListMessagesHasRemoteMoreAndRemoteTotal(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	_, err = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at) VALUES
		('acc-1','Work','工作','a@ex.com','imap','IMAP','imap','imap.ex',993,'SSL/TLS','smtp.ex',465,'SSL/TLS',1),
		('acc-2','Home','个人','b@ex.com','imap','IMAP','imap','imap.ex',993,'SSL/TLS','smtp.ex',465,'SSL/TLS',1)`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO remote_mailboxes(id,account_id,remote_name,local_folder,uid_validity,last_uid,oldest_uid,history_exhausted,total_count,updated_at) VALUES
		('acc-1:INBOX','acc-1','INBOX','inbox',1,500,351,0,500,1),
		('acc-2:INBOX','acc-2','INBOX','inbox',1,80,1,1,80,1)`)
	if err != nil {
		t.Fatal(err)
	}

	// 统一收件箱：acc-1 尚未耗尽，acc-2 已耗尽 → HasRemoteMore=true, RemoteTotalCount=580
	pageAll, err := ListMessages(db, MailSearchQuery{Folder: "inbox"}, true)
	if err != nil {
		t.Fatal(err)
	}
	if !pageAll.HasRemoteMore || pageAll.RemoteTotalCount != 580 {
		t.Fatalf("期望 HasRemoteMore=true, RemoteTotalCount=580，实际 %+v", pageAll)
	}

	// 单独查看已耗尽账号 acc-2 → HasRemoteMore=false, RemoteTotalCount=80
	pageAcc2, err := ListMessages(db, MailSearchQuery{Folder: "inbox", AccountIDs: []string{"acc-2"}}, true)
	if err != nil {
		t.Fatal(err)
	}
	if pageAcc2.HasRemoteMore || pageAcc2.RemoteTotalCount != 80 {
		t.Fatalf("期望 acc-2 HasRemoteMore=false, RemoteTotalCount=80，实际 %+v", pageAcc2)
	}

	// 搜索过滤或本地文件夹不应提示远端余量
	pageSearch, err := ListMessages(db, MailSearchQuery{Folder: "inbox", Keyword: "invoice"}, true)
	if err != nil || pageSearch.HasRemoteMore {
		t.Fatalf("搜索态不应返回 HasRemoteMore=true: %+v err=%v", pageSearch, err)
	}
	pageStarred, err := ListMessages(db, MailSearchQuery{Folder: "starred"}, true)
	if err != nil || pageStarred.HasRemoteMore {
		t.Fatalf("星标视图不应返回 HasRemoteMore=true: %+v err=%v", pageStarred, err)
	}

	// 标记 acc-1 也耗尽后，统一收件箱返回 HasRemoteMore=false
	_, _ = db.Exec(`UPDATE remote_mailboxes SET history_exhausted=1 WHERE id='acc-1:INBOX'`)
	pageDone, err := ListMessages(db, MailSearchQuery{Folder: "inbox"}, true)
	if err != nil || pageDone.HasRemoteMore {
		t.Fatalf("全部耗尽后期望 HasRemoteMore=false: %+v err=%v", pageDone, err)
	}
}
