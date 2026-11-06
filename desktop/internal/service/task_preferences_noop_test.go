package service

import (
	"context"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

func TestUnchangedTaskSettingsDoNotCancelActiveBatch(t *testing.T) {
	started := make(chan struct{}, 1)
	s, _, _, account, _, id := requirementFixture(t, requirementFunc(func(ctx context.Context, _ domain.AIConfig, _ []byte, _ domain.RequirementInput) (domain.RequirementOutput, error) {
		started <- struct{}{}
		<-ctx.Done()
		return domain.RequirementOutput{}, ctx.Err()
	}))
	input := taskInput(account.ID)
	first, err := s.SavePreferences(t.Context(), input)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.RunBatch(t.Context(), domain.TaskBatchInput{MailIDs: []string{id}}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("合成批次未开始")
	}
	same, err := s.SavePreferences(t.Context(), input)
	if err != nil || same.Revision != first.Revision || !s.State().Running {
		t.Fatal("未改动的保存不应换版本或取消批次", err)
	}
}
