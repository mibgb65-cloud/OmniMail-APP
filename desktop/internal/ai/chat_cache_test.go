package ai

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/profilemgr"
	"omnimail/internal/storage"
)

func seedAiChatMails(t *testing.T, db *sql.DB) {
	t.Helper()
	for _, stmt := range []string{
		`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		 VALUES ('acc','Work','工作','me@example.com','imap','IMAP','password','imap.example.com',993,'SSL/TLS','smtp.example.com',465,'SSL/TLS',1)`,
		`INSERT INTO threads(id,account_id,subject,snippet,last_msg_at) VALUES ('thread','acc','Subject','Snippet',1)`,
		`INSERT INTO messages(id,account_id,thread_id,folder,sender_name,sender_email,subject,body_text,sent_at,received_at)
		 VALUES ('mail-a','acc','thread','inbox','Alice','alice@example.com','Note','正文',1,1),
		        ('mail-b','acc','thread','inbox','Bob','bob@example.com','Other','另一封正文',1,1)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatal(err)
		}
	}
}

func TestAskStreamPersistsFinalAnswerBeforeDone(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	seedAiChatMails(t, db)
	const answer = "**重要**\n\n- 一项"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\ndata: [DONE]\n\n", answer)
	}))
	defer server.Close()
	settings := config.DefaultAppSettings()
	settings.AiEnabled, settings.AiRequireConfirmEachTime = true, true
	settings.AiProvider, settings.AiBaseURL = "custom", server.URL
	if err := config.SaveProfileSettings(dir, settings); err != nil {
		t.Fatal(err)
	}

	const id = "aireq-00000000-0000-4000-8000-000000000001"
	result := make(chan error, 1)
	bus := events.NewBus()
	gw := NewGateway(bus)
	bus.Subscribe(func(name string, payload any) {
		switch name {
		case events.AiDone:
			done := payload.(events.AiDonePayload)
			insight, turns, _ := gw.GetCachedInsight(t.Context(), db, "mail-a")
			if done.RequestID != id || done.FullText != answer || insight != nil ||
				len(turns) != 2 || turns[0].ID != id+"-user" || turns[1].Content != answer {
				result <- fmt.Errorf("流式完成事件与数据库问答不一致")
				return
			}
			result <- nil
		case events.AiError:
			result <- fmt.Errorf("流式调用失败：%s", payload.(events.AiErrorPayload).Message)
		}
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sess := &profilemgr.Session{ProfileDir: dir, DB: db, Ctx: ctx}
	reqID, err := gw.AskMailStream(sess, AskMailRequest{
		RequestID: id, MailID: "mail-a", Question: "有什么要点？", ConsentConfirmed: true,
	})
	if err != nil || reqID != id {
		t.Fatalf("启动 AI 问答失败：%v", err)
	}
	select {
	case err := <-result:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("等待流式完成事件超时")
	}
	storage.CheckpointAndClose(db)

	db, err = storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	if _, turns, _ := gw.GetCachedInsight(t.Context(), db, "mail-b"); len(turns) != 0 {
		t.Fatal("问答越过邮件边界")
	}
	insight, turns, _ := gw.GetCachedInsight(t.Context(), db, "mail-a")
	if insight != nil || len(turns) != 2 || turns[0].Content != "有什么要点？" || turns[1].Content != answer {
		t.Fatal("重新打开数据库后问答内容未恢复")
	}
}

func TestChatCacheKeepsRecentPairsAndSummary(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	seedAiChatMails(t, db)
	if _, err := db.Exec(`INSERT INTO ai_insights(message_id,model_name,insight_json,chat_turns_json,updated_at)
		VALUES ('mail-a','test','{"summary":"已有摘要"}','[{"id":"t-u-1","role":"user","content":"旧版提问"},{"id":"t-a-2","role":"assistant","content":"旧版回复"}]',1)`); err != nil {
		t.Fatal(err)
	}
	if history, err := loadChatHistory(db, "mail-a", false); err != nil || len(history) != 0 {
		t.Fatalf("旧版问答不应自动外发：%v", err)
	}
	for i := range 12 {
		id := fmt.Sprintf("aireq-%d", i)
		if err := appendChatTurnsToDB(context.Background(), db, "mail-a", "test", id, "问题", "回复", i%2 == 0); err != nil {
			t.Fatal(err)
		}
	}
	if history, err := loadChatHistory(db, "mail-a", false); err != nil || len(history) != 10 || history[0].ID != "aireq-3-user" {
		t.Fatalf("不同隐私范围的问答不应自动外发：%v", err)
	}
	insight, turns, _ := NewGateway(nil).GetCachedInsight(t.Context(), db, "mail-a")
	if insight == nil || insight.Summary != "已有摘要" || len(turns) != 20 ||
		turns[0].ID != "aireq-2-user" || turns[19].ID != "aireq-11-assistant" {
		t.Fatalf("摘要或最近十轮问答顺序异常：摘要=%v，问答数=%d", insight != nil, len(turns))
	}
}
