package service

import (
	"context"
	"errors"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
)

type requirementFunc func(context.Context, domain.AIConfig, []byte, domain.RequirementInput) (domain.RequirementOutput, error)

func (f requirementFunc) Extract(ctx context.Context, c domain.AIConfig, key []byte, input domain.RequirementInput) (domain.RequirementOutput, error) {
	return f(ctx, c, key, input)
}
func requirementFixture(t *testing.T, provider domain.RequirementProvider) (*Tasks, *AI, *repository.Store, domain.Account, domain.MailboxCursor, string) {
	t.Helper()
	_, store, secrets, _ := testService(t)
	account, err := accountFromInput(addInput())
	if err != nil {
		t.Fatal(err)
	}
	account, err = store.CreateAccount(t.Context(), account)
	if err != nil {
		t.Fatal(err)
	}
	box, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	id := addRequirementMail(t, store, account.ID, box.ID, 1)
	if err := store.ObserveMailboxHead(t.Context(), account.ID, box.ID, 7, 1); err != nil {
		t.Fatal(err)
	}
	ai := NewAI(store, repository.NewAIStore(t.TempDir()), secrets, aiProviderFunc(func(context.Context, domain.AIConfig, []byte, domain.TranslatedText, domain.AIRequest) (domain.AIOutput, error) {
		return aiOutput(), nil
	}))
	t.Cleanup(ai.Close)
	if _, err := ai.SaveConfig(t.Context(), aiInput()); err != nil {
		t.Fatal(err)
	}
	tasks, err := NewTasks(store, ai, provider, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(tasks.Close)
	return tasks, ai, store, account, box, id
}
func addRequirementMail(t *testing.T, store *repository.Store, account, box string, uid uint32) string {
	t.Helper()
	if err := store.SaveMailBatch(t.Context(), account, box, 7, uid, uid, []domain.RemoteMessage{{UID: uid, Subject: "synthetic requirement", ReceivedAt: int64(uid)}}, nil); err != nil {
		t.Fatal(err)
	}
	list, err := store.PageMail(t.Context(), account, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	id := list[0].ID
	if err := store.SaveMailBody(t.Context(), id, domain.DecodedMail{Text: "Please deliver Friday."}); err != nil {
		t.Fatal(err)
	}
	return id
}
func taskInput(account string) domain.TaskPreferencesInput {
	return domain.TaskPreferencesInput{Consent: true, Accounts: []string{account}, Folders: []string{"inbox"}, Time: "09:00", Timezone: "Asia/Singapore", Limit: 20}
}
func waitRequirements(t *testing.T, s *Tasks, id string) domain.TaskRun {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if !s.State().Running {
			value, err := s.RunDetail(t.Context(), id)
			if err != nil {
				t.Fatal(err)
			}
			return value.Run
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("任务未结束")
	return domain.TaskRun{}
}
func successfulRequirement(_ context.Context, _ domain.AIConfig, _ []byte, input domain.RequirementInput) (domain.RequirementOutput, error) {
	return domain.RequirementOutput{Items: []domain.Requirement{{Title: "Deliver", Evidence: input.Source.Body, Due: "Friday", Kind: "new"}}}, nil
}

func TestTaskBatchSeparateConsentDedupeAndConfigChange(t *testing.T) {
	var calls atomic.Int32
	s, ai, store, account, _, id := requirementFixture(t, requirementFunc(func(ctx context.Context, c domain.AIConfig, key []byte, input domain.RequirementInput) (domain.RequirementOutput, error) {
		calls.Add(1)
		return successfulRequirement(ctx, c, key, input)
	}))
	request := domain.TaskBatchInput{MailIDs: []string{id}}
	if _, err := s.RunBatch(t.Context(), request); !errors.Is(err, domain.ErrTaskConsent) || calls.Load() != 0 {
		t.Fatal("单封授权被用于后台", err)
	}
	if _, err := s.SavePreferences(t.Context(), taskInput(account.ID)); err != nil {
		t.Fatal(err)
	}
	run, err := s.RunBatch(t.Context(), request)
	if err != nil {
		t.Fatal(err)
	}
	value := waitRequirements(t, s, run)
	if value.Done != 1 || value.NewTodos != 1 || calls.Load() != 1 {
		t.Fatal("批次结果错误", value)
	}
	run, err = s.RunBatch(t.Context(), request)
	if err != nil {
		t.Fatal(err)
	}
	waitRequirements(t, s, run)
	if calls.Load() != 1 {
		t.Fatal("成功邮件重复调用")
	}
	mail, err := store.ReadMail(t.Context(), id)
	if err != nil || mail.Read {
		t.Fatal("后台分析标记了已读")
	}
	if _, err := ai.SaveConfig(t.Context(), aiInput()); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RunBatch(t.Context(), request); !errors.Is(err, domain.ErrTaskConfig) || calls.Load() != 1 {
		t.Fatal("旧目的地授权继续生效", err)
	}
}

func TestDailyLatestSlotIncrementalAndNoUnreadDependency(t *testing.T) {
	var calls atomic.Int32
	s, _, store, account, box, _ := requirementFixture(t, requirementFunc(func(ctx context.Context, c domain.AIConfig, key []byte, input domain.RequirementInput) (domain.RequirementOutput, error) {
		calls.Add(1)
		return successfulRequirement(ctx, c, key, input)
	}))
	p := taskInput(account.ID)
	p.Enabled = true
	if _, err := s.SavePreferences(t.Context(), p); err != nil {
		t.Fatal(err)
	}
	id := addRequirementMail(t, store, account.ID, box.ID, 2)
	if err := store.UpdateMailRead(t.Context(), id, true); err != nil {
		t.Fatal(err)
	}
	now, err := time.Parse(time.RFC3339, "2026-11-06T08:00:00+08:00")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.tick(t.Context(), now); err != nil {
		t.Fatal(err)
	}
	run := waitRequirements(t, s, s.State().RunID)
	if run.Slot != "2026-11-05@Asia/Singapore" || run.Total != 1 || run.NewTodos != 1 || calls.Load() != 1 {
		t.Fatal("补跑/历史筛选错误", run)
	}
	if err := s.tick(t.Context(), now); err != nil {
		t.Fatal(err)
	}
	if s.State().Running || calls.Load() != 1 {
		t.Fatal("同槽位重复执行")
	}
}

func TestRevokingTaskConsentCancelsInFlightWithoutSaving(t *testing.T) {
	started := make(chan struct{}, 1)
	s, _, store, account, _, id := requirementFixture(t, requirementFunc(func(ctx context.Context, _ domain.AIConfig, _ []byte, _ domain.RequirementInput) (domain.RequirementOutput, error) {
		started <- struct{}{}
		<-ctx.Done()
		return domain.RequirementOutput{}, ctx.Err()
	}))
	p := taskInput(account.ID)
	if _, err := s.SavePreferences(t.Context(), p); err != nil {
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
	p.Consent = false
	if _, err := s.SavePreferences(t.Context(), p); err != nil {
		t.Fatal(err)
	}
	result := waitRequirements(t, s, run)
	if result.Unknown != 1 || result.State != "cancelled" {
		t.Fatal("撤销未保留未知结果", result)
	}
	items, err := store.ListTodos(t.Context(), "all", 0)
	if err != nil || len(items) != 0 {
		t.Fatal("撤销后仍保存事项")
	}
}

func TestDailyTaskSlotUsesConfiguredTimezone(t *testing.T) {
	for _, test := range []struct{ now, zone, want string }{
		{"2026-11-03T00:30:00+08:00", "Asia/Singapore", "2026-11-02@Asia/Singapore"},
		{"2026-11-03T10:00:00+08:00", "Asia/Singapore", "2026-11-03@Asia/Singapore"},
		{"2026-11-03T10:00:00Z", "America/New_York", "2026-11-02@America/New_York"},
	} {
		now, err := time.Parse(time.RFC3339, test.now)
		if err != nil {
			t.Fatal(err)
		}
		slot, err := dailyTaskSlot(now, domain.TaskPreferencesInput{Time: "09:00", Timezone: test.zone})
		if err != nil || slot != test.want {
			t.Fatal("时区/跨日错误", slot, err)
		}
	}
}

func TestStartupRecoveryContinuesOnlyUnstartedMails(t *testing.T) {
	var calls atomic.Int32
	s, _, store, account, box, id := requirementFixture(t, requirementFunc(func(ctx context.Context, c domain.AIConfig, key []byte, input domain.RequirementInput) (domain.RequirementOutput, error) {
		calls.Add(1)
		return successfulRequirement(ctx, c, key, input)
	}))
	p, err := s.SavePreferences(t.Context(), taskInput(account.ID))
	if err != nil {
		t.Fatal(err)
	}
	second := addRequirementMail(t, store, account.ID, box.ID, 2)
	run, _, err := store.CreateTaskRun(t.Context(), "manual", "", p.Revision, []string{id, second}, false, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	source, err := store.ReadTaskMail(t.Context(), id)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.ReserveTaskMail(t.Context(), run.ID, source, strings.Repeat("d", 64), false); err != nil {
		t.Fatal(err)
	}
	if err := store.RecoverTaskRuns(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := s.tick(t.Context(), time.Now()); err != nil {
		t.Fatal(err)
	}
	result := waitRequirements(t, s, run.ID)
	if calls.Load() != 1 || result.Unknown != 1 || result.Done != 1 || result.State != "partial" {
		t.Fatal("恢复重发未知项或漏掉未开始项", result, calls.Load())
	}
}

func TestTaskWaitsForLocalCooldownWithoutConsumingQueueAndCanStop(t *testing.T) {
	var calls atomic.Int32
	s, ai, _, account, _, id := requirementFixture(t, requirementFunc(func(ctx context.Context, c domain.AIConfig, key []byte, input domain.RequirementInput) (domain.RequirementOutput, error) {
		calls.Add(1)
		return successfulRequirement(ctx, c, key, input)
	}))
	if _, err := s.SavePreferences(t.Context(), taskInput(account.ID)); err != nil {
		t.Fatal(err)
	}
	ai.mu.Lock()
	ai.cooldown = time.Now().Add(time.Hour)
	ai.mu.Unlock()
	run, err := s.RunBatch(t.Context(), domain.TaskBatchInput{MailIDs: []string{id}})
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(60 * time.Millisecond)
	detail, err := s.RunDetail(t.Context(), run)
	if err != nil || detail.Run.Pending != 1 || detail.Run.Failed != 0 || !s.State().Running || calls.Load() != 0 {
		t.Fatal("本地限流等待被当作失败或消耗队列", detail.Run, err)
	}
	s.Stop()
	result := waitRequirements(t, s, run)
	if result.State != "cancelled" || result.Pending != 1 || result.Unknown != 0 {
		t.Fatal("未外发的等待任务无法安全停止", result)
	}
}
