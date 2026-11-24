package syncer

import (
	"context"
	"testing"

	"github.com/emersion/go-imap/v2"

	"omnimail/internal/storage"
)

func TestPickOlderUIDBatchAndExhaustion(t *testing.T) {
	candidates := []imap.UID{10, 40, 20, 30, 50, 60, 70}
	batch, exhausted := pickOlderUIDBatch(candidates, 50, 2)
	if exhausted {
		t.Fatalf("仍有更早 UID，不应标记耗尽")
	}
	if len(batch) != 2 || batch[0] != 40 || batch[1] != 30 {
		t.Fatalf("期望 [40 30]，实际 %+v", batch)
	}

	batch2, exhausted2 := pickOlderUIDBatch(candidates, 30, 5)
	if !exhausted2 {
		t.Fatalf("剩余 UID 数量 <= limit，应标记耗尽")
	}
	if len(batch2) != 2 || batch2[0] != 20 || batch2[1] != 10 {
		t.Fatalf("期望 [20 10]，实际 %+v", batch2)
	}

	batchMin, exhaustedMin := pickOlderUIDBatch([]imap.UID{1, 2, 3}, 4, 3)
	if !exhaustedMin || len(batchMin) != 3 || batchMin[2] != 1 {
		t.Fatalf("抵达 UID 1 应标记耗尽: batch=%+v exhausted=%v", batchMin, exhaustedMin)
	}

	empty, exhaustedEmpty := pickOlderUIDBatch([]imap.UID{50, 60}, 50, 10)
	if !exhaustedEmpty || len(empty) != 0 {
		t.Fatalf("无小于 oldestUID 的记录时应标记耗尽")
	}
}

func TestUpdateMailboxSyncCursorsAndSaveBackfillProgress(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	_, err = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-1','Work','工作','me@studio.example','imap','IMAP','imap','imap.example',993,'SSL/TLS','smtp.example',465,'SSL/TLS',1)`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO remote_mailboxes(id,account_id,remote_name,local_folder,uid_validity,last_uid,oldest_uid,history_exhausted,total_count,updated_at)
		VALUES ('acc-1:INBOX','acc-1','INBOX','inbox',1,0,0,0,400,1)`)
	if err != nil {
		t.Fatal(err)
	}

	// 首轮截断同步（400 封仅拉取 150 封）→ oldest_uid=251, history_exhausted=0
	updateMailboxSyncCursors(db, "acc-1:INBOX", 0, 0, 400, 251, 150, 400)
	var lastUID, oldestUID, exhausted int
	_ = db.QueryRow(`SELECT last_uid, oldest_uid, history_exhausted FROM remote_mailboxes WHERE id='acc-1:INBOX'`).Scan(&lastUID, &oldestUID, &exhausted)
	if lastUID != 400 || oldestUID != 251 || exhausted != 0 {
		t.Fatalf("首轮截断游标异常: last=%d oldest=%d exhausted=%d", lastUID, oldestUID, exhausted)
	}

	// 中途回溯一批（201..250）→ oldest_uid=201, history_exhausted=0
	saveBackfillProgress(db, "acc-1:INBOX", 201, 400, 400, false)
	_ = db.QueryRow(`SELECT oldest_uid, history_exhausted FROM remote_mailboxes WHERE id='acc-1:INBOX'`).Scan(&oldestUID, &exhausted)
	if oldestUID != 201 || exhausted != 0 {
		t.Fatalf("批次推进游标异常: oldest=%d exhausted=%d", oldestUID, exhausted)
	}

	// 抵达 UID 1 → 自动置 history_exhausted=1
	saveBackfillProgress(db, "acc-1:INBOX", 1, 400, 400, false)
	_ = db.QueryRow(`SELECT oldest_uid, history_exhausted FROM remote_mailboxes WHERE id='acc-1:INBOX'`).Scan(&oldestUID, &exhausted)
	if oldestUID != 1 || exhausted != 1 {
		t.Fatalf("抵达 UID 1 应置耗尽: oldest=%d exhausted=%d", oldestUID, exhausted)
	}

	// 本地文件夹直接返回 HasRemoteMore=false 且不报错
	mgr := NewManager(nil, nil)
	for _, localOnly := range []string{"starred", "outbox", "scheduled", "snoozed"} {
		res, err := mgr.LoadOlderMessages(context.Background(), "", localOnly, 50)
		if err != nil || res.HasRemoteMore {
			t.Fatalf("本地文件夹 %s 不应触发回溯: res=%+v err=%v", localOnly, res, err)
		}
	}
}
