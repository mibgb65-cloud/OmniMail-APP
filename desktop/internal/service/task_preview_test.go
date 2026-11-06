package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestTaskBatchPreflightIsReadOnlyAndChecksFolderScope(t *testing.T) {
	var calls atomic.Int32
	s, _, store, account, _, id := requirementFixture(t, requirementFunc(func(ctx context.Context, c domain.AIConfig, key []byte, input domain.RequirementInput) (domain.RequirementOutput, error) {
		calls.Add(1)
		return successfulRequirement(ctx, c, key, input)
	}))
	input := taskInput(account.ID)
	if _, err := s.SavePreferences(t.Context(), input); err != nil {
		t.Fatal(err)
	}
	batch := domain.TaskBatchInput{MailIDs: []string{id}}
	if err := s.CheckBatch(t.Context(), batch); err != nil {
		t.Fatal(err)
	}
	runs, err := store.TaskRuns(t.Context())
	if err != nil || len(runs) != 0 || calls.Load() != 0 {
		t.Fatal("核对阶段不能创建批次或调用模型")
	}
	input.Folders = []string{"archive"}
	if _, err := s.SavePreferences(t.Context(), input); err != nil {
		t.Fatal(err)
	}
	if err := s.CheckBatch(t.Context(), batch); !errors.Is(err, domain.ErrTaskConsent) {
		t.Fatal("核对阶段没有拒绝未授权文件夹", err)
	}
	if calls.Load() != 0 {
		t.Fatal("未授权核对外发")
	}
}
