package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/profilemgr"
	"omnimail/internal/storage"
)

func TestMailTranslationPublishesBeforeSecondBatchCompletes(t *testing.T) {
	for _, failSecond := range []bool{false, true} {
		t.Run(fmt.Sprintf("secondFailure=%t", failSecond), func(t *testing.T) {
			runTwoTranslationBatches(t, failSecond)
		})
	}
}

func runTwoTranslationBatches(t *testing.T, failSecond bool) {
	t.Helper()
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	seedAiChatMails(t, db)
	const subject = "Release status"
	var paragraphs []string
	for i := 1; i <= 46; i++ {
		paragraphs = append(paragraphs, fmt.Sprintf("Build information %d", i))
	}
	if _, err := db.Exec(`UPDATE messages SET subject=?, body_text=? WHERE id='mail-a'`,
		subject, strings.Join(paragraphs, "\n")); err != nil {
		t.Fatal(err)
	}

	var requests atomic.Int32
	secondStarted := make(chan struct{})
	allowSecond := make(chan struct{})
	var once sync.Once
	release := func() { once.Do(func() { close(allowSecond) }) }
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		call := requests.Add(1)
		var payload struct{ Messages []ChatMessage }
		var inputs []string
		if json.NewDecoder(req.Body).Decode(&payload) != nil || len(payload.Messages) != 2 ||
			json.Unmarshal([]byte(payload.Messages[1].Content), &inputs) != nil {
			http.Error(w, "invalid test request", http.StatusBadRequest)
			return
		}
		if call == 2 {
			close(secondStarted)
			select {
			case <-allowSecond:
			case <-req.Context().Done():
				return
			}
		}
		expected := map[int32]int{1: 45, 2: 2}
		if len(inputs) != expected[call] {
			http.Error(w, "unexpected batch size", http.StatusBadRequest)
			return
		}
		output := make([]string, len(inputs))
		for i, input := range inputs {
			output[i] = "译：" + input
		}
		if call == 2 && failSecond {
			output = output[:1] // 让第二批校验不通过，而非发出坏片段。
		}
		reply, _ := json.Marshal(map[string]any{"source": "en", "segments": output})
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\ndata: [DONE]\n\n", string(reply))
	}))
	defer server.Close()
	defer release()
	settings := config.DefaultAppSettings()
	settings.TranslationProvider = config.TranslationProviderAI
	settings.AiEnabled, settings.AiProvider, settings.AiBaseURL = true, "custom", server.URL
	if err := config.SaveProfileSettings(dir, settings); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	bus := events.NewBus()
	batches := make(chan events.MailTranslationBatchPayload, 2)
	bus.Subscribe(func(name string, data any) {
		if name == events.MailTranslationBatch {
			batches <- data.(events.MailTranslationBatchPayload)
		}
	})
	session := &profilemgr.Session{
		Meta: config.ProfileMeta{ID: "profile-progress"}, ProfileDir: dir, DB: db, Ctx: ctx,
	}
	req := TranslateMailRequest{
		ProfileID: session.Meta.ID, MailID: "mail-a", RequestID: "00000000-0000-4000-8000-000000000002",
		Source: "auto", Target: "zh-CN", IncludeSubject: true, ConsentConfirmed: true,
	}
	type outcome struct {
		result MailTranslation
		err    error
	}
	done := make(chan outcome, 1)
	go func() {
		result, err := NewGateway(bus).TranslateMail(ctx, session, req)
		done <- outcome{result, err}
	}()
	var first events.MailTranslationBatchPayload
	select {
	case first = <-batches:
	case out := <-done:
		t.Fatalf("等待第二批之前未收到第一批：%v", out.err)
	case <-ctx.Done():
		t.Fatal("等待第一批超时")
	}
	select {
	case <-secondStarted:
	case <-ctx.Done():
		t.Fatal("第二批未按批次启动")
	}
	if first.CompletedBatches != 1 || first.TotalBatches != 2 || first.ProfileID != req.ProfileID ||
		first.MailID != req.MailID || first.RequestID != req.RequestID ||
		first.Subject != "译："+subject || first.Segments[paragraphs[0]] != "译："+paragraphs[0] ||
		first.Segments[paragraphs[45]] != "" {
		t.Fatal("第一批已可用时不应包含尚未完成的下一批正文")
	}
	select {
	case <-done:
		t.Fatal("第二批处于等待时最终响应不能返回")
	default:
	}
	release()
	var final outcome
	select {
	case final = <-done:
	case <-ctx.Done():
		t.Fatal("等待终态快照超时")
	}
	if final.err != nil || final.result.Subject != first.Subject || final.result.TotalBatches != 2 ||
		final.result.Segments[paragraphs[0]] != first.Segments[paragraphs[0]] || requests.Load() != 2 {
		t.Fatalf("终态应包含已校验的第一批，且只发出两次批量请求：%v", final.err)
	}
	if failSecond {
		if final.result.CompletedBatches != 1 || len(batches) != 0 || final.result.Segments[paragraphs[45]] != "" {
			t.Fatal("校验失败的第二批不能发布，且终态应标明只完成一批")
		}
	} else {
		if final.result.CompletedBatches != 2 || len(batches) != 1 || final.result.Segments[paragraphs[45]] == "" {
			t.Fatal("两批均成功时应发布两批及返回完整终态")
		}
		second := <-batches
		if second.CompletedBatches != 2 || len(second.Segments) != 2 || second.Subject != "" || len(first.Segments) != 45 {
			t.Fatal("每个事件只包含该批新增片段，不能回写旧事件")
		}
	}
}
