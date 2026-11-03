package service

import (
	"context"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

func TestTaskConstructionDoesNotRecoverAnotherActiveInstance(t *testing.T) {
	started := make(chan struct{}, 1)
	provider := requirementFunc(func(ctx context.Context, _ domain.AIConfig, _ []byte, _ domain.RequirementInput) (domain.RequirementOutput, error) {
		started <- struct{}{}
		<-ctx.Done()
		return domain.RequirementOutput{}, ctx.Err()
	})
	s, ai, store, account, _, id := requirementFixture(t, provider)
	if _, err := s.SavePreferences(t.Context(), taskInput(account.ID)); err != nil {
		t.Fatal(err)
	}
	run, err := s.RunBatch(t.Context(), domain.TaskBatchInput{MailIDs: []string{id}})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("请求未开始")
	}
	other, err := NewTasks(store, ai, provider, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer other.Close()
	details, err := s.RunDetail(t.Context(), run)
	if err != nil || len(details.Mails) != 1 || details.Mails[0].State != "processing" {
		t.Fatal("第二实例尚未取得运行权就修改了活动任务", err)
	}
}
