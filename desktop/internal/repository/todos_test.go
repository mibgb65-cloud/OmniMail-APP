package repository

import (
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestTodoPersistenceAndOptimisticEditing(t *testing.T) {
	s := openTestStore(t)
	item, err := s.EditTodo(t.Context(), domain.TodoEdit{Title: "synthetic todo", Status: "open"})
	if err != nil {
		t.Fatal(err)
	}
	edit := domain.TodoEdit{ID: item.ID, Version: item.Version, Title: "human title", Notes: "human notes", Status: "done"}
	changed, err := s.EditTodo(t.Context(), edit)
	if err != nil || changed.Version != 2 {
		t.Fatal("编辑失败", err)
	}
	if _, err := s.EditTodo(t.Context(), edit); !errors.Is(err, domain.ErrTaskConflict) {
		t.Fatal("旧版本覆盖人工修改", err)
	}
	details, err := s.TodoDetails(t.Context(), item.ID)
	if err != nil || details.Item.Notes != "human notes" || details.Item.Status != "done" {
		t.Fatal("未保存人工状态", err)
	}
	if err := s.DeleteTodo(t.Context(), item.ID, 1); !errors.Is(err, domain.ErrTaskConflict) {
		t.Fatal("旧版本删除成功")
	}
	if err := s.DeleteTodo(t.Context(), item.ID, 2); err != nil {
		t.Fatal(err)
	}
}

func TestTaskBaselineExcludesHistoryAndWaitsForBody(t *testing.T) {
	s := openTestStore(t)
	account, box := seedMailbox(t, s)
	if err := s.ObserveMailboxHead(t.Context(), account.ID, box.ID, 7, 10); err != nil {
		t.Fatal(err)
	}
	p := domain.TaskPreferences{TaskPreferencesInput: domain.TaskPreferencesInput{
		Accounts: []string{account.ID}, Folders: []string{"inbox"}, Time: "09:00", Timezone: "UTC", Limit: 20, Consent: true},
		Revision: "settings_1", AIRevision: "config_1"}
	if err := s.WriteTaskPreferences(t.Context(), p); err != nil {
		t.Fatal(err)
	}
	messages := []domain.RemoteMessage{{UID: 11, Subject: "new", ReceivedAt: 1}, {UID: 12, Subject: "pending", ReceivedAt: 1}}
	if err := s.SaveMailBatch(t.Context(), account.ID, box.ID, 7, 11, 12, messages, nil); err != nil {
		t.Fatal(err)
	}
	list, err := s.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	var newID string
	for _, mail := range list {
		if mail.Subject == "new" {
			newID = mail.ID
		}
	}
	if err := s.SaveMailBody(t.Context(), newID, domain.DecodedMail{Text: "synthetic body"}); err != nil {
		t.Fatal(err)
	}
	ids, waiting, remaining, err := s.PendingTaskMails(t.Context(), p)
	if err != nil || len(ids) != 1 || ids[0] != newID || waiting != 1 || remaining != 0 {
		t.Fatalf("历史/正文/已读不应误筛选 %v %v %d %d", err, ids, waiting, remaining)
	}
	mail, err := s.ReadTaskMail(t.Context(), newID)
	if err != nil || mail.Read || mail.BodyRevision < 1 {
		t.Fatal("后台读取改动已读或正文版本无效", err)
	}
	for _, item := range list {
		if item.Subject == "pending" {
			if err := s.SaveMailBody(t.Context(), item.ID, domain.DecodedMail{Text: "ready later"}); err != nil {
				t.Fatal(err)
			}
		}
	}
	p.Limit = 1
	ids, waiting, remaining, err = s.PendingTaskMails(t.Context(), p)
	if err != nil || len(ids) != 1 || waiting != 0 || remaining != 1 {
		t.Fatal("限额不能把剩余邮件当作已完成", ids, waiting, remaining, err)
	}
}
