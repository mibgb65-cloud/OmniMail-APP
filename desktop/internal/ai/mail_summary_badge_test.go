package ai

import (
	"testing"

	"omnimail/internal/search"
	"omnimail/internal/storage"
)

func TestListReadsSavedLegacySummaryButNotChatOnly(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	seedAiChatMails(t, db)

	if _, err := db.Exec(`INSERT INTO ai_insights(message_id, model_name, insight_json, chat_turns_json, updated_at)
		VALUES ('mail-a','test','{"summary":"旧版已保存摘要"}','[]',1),
		       ('mail-b','test','{}','[{"role":"assistant","content":"已有问答"}]',1)`); err != nil {
		t.Fatal(err)
	}
	page, err := search.ListMessages(db, search.MailSearchQuery{Folder: "inbox"}, true)
	if err != nil || len(page.Items) != 2 {
		t.Fatalf("读取邮件列表失败：%v", err)
	}
	for _, item := range page.Items {
		if item.AiSummarized != (item.ID == "mail-a") {
			t.Fatal("只有存在已保存的摘要时才恢复旧版列表标记")
		}
	}
	if _, err := db.Exec(`UPDATE ai_insights SET insight_json='invalid json' WHERE message_id='mail-a'`); err != nil {
		t.Fatal(err)
	}
	item, err := search.GetMessageItem(db, "mail-a", false, true)
	if err != nil || item.AiSummarized {
		t.Fatalf("损坏的旧摘要不能获得标记，也不应影响邮件读取：%v", err)
	}
}

func TestSummaryAndListFlagWriteAtomically(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	seedAiChatMails(t, db)
	if _, err := db.Exec(`CREATE TRIGGER reject_summary_flag BEFORE UPDATE OF ai_summarized ON messages
		BEGIN SELECT RAISE(ABORT, 'test write rejection'); END`); err != nil {
		t.Fatal(err)
	}
	if _, err := saveMailInsight(t.Context(), db, "mail-a", "test", "", map[string]any{"summary": "测试摘要"}, true); err == nil {
		t.Fatal("列表标记写入失败应返回错误")
	}
	if insight, _, err := NewGateway(nil).GetCachedInsight(t.Context(), db, "mail-a"); err != nil || insight != nil {
		t.Fatal("标记写入失败时必须回滚摘要")
	}
}
