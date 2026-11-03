package repository

import (
	"errors"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func taskRepoFixture(t *testing.T) (*Store, domain.TaskPreferences, []domain.TaskMail) {
	t.Helper()
	s := openTestStore(t)
	account, _ := seedMailbox(t, s)
	p := domain.TaskPreferences{TaskPreferencesInput: domain.TaskPreferencesInput{Consent: true, Accounts: []string{account.ID}, Folders: []string{"inbox"}, Time: "09:00", Timezone: "UTC", Limit: 20}, Revision: "scope_test", AIRevision: "config_test"}
	if err := s.WriteTaskPreferences(t.Context(), p); err != nil {
		t.Fatal(err)
	}
	list, err := s.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	result := []domain.TaskMail{}
	for _, item := range list {
		if err := s.SaveMailBody(t.Context(), item.ID, domain.DecodedMail{Text: "Alice needs it Friday."}); err != nil {
			t.Fatal(err)
		}
		mail, err := s.ReadTaskMail(t.Context(), item.ID)
		if err != nil {
			t.Fatal(err)
		}
		result = append(result, mail)
	}
	return s, p, result
}
func reserveAndCommit(t *testing.T, s *Store, p domain.TaskPreferences, mail domain.TaskMail, key string, out domain.RequirementOutput, candidates []domain.RequirementCandidate) {
	t.Helper()
	run, _, err := s.CreateTaskRun(t.Context(), "manual", "", p.Revision, []string{mail.ID}, false, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	call, err := s.ReserveTaskMail(t.Context(), run.ID, mail, key, false)
	if err != nil || !call {
		t.Fatal("预留失败", err)
	}
	input := domain.RequirementInput{Source: domain.TranslatedText{Subject: mail.Subject, Body: mail.Body}, Candidates: candidates}
	if err := s.CommitRequirements(t.Context(), run.ID, mail, key, input, out); err != nil {
		t.Fatal(err)
	}
}

func TestRequirementsDedupeProposalsAndHumanState(t *testing.T) {
	s, p, mails := taskRepoFixture(t)
	out := domain.RequirementOutput{Items: []domain.Requirement{{Title: "AI title", Evidence: mails[0].Body, Owner: "Alice", Due: "Friday", Kind: "new"}}}
	reserveAndCommit(t, s, p, mails[0], strings.Repeat("a", 64), out, nil)
	items, err := s.ListTodos(t.Context(), "all", 0)
	if err != nil || len(items) != 1 {
		t.Fatal("事项未落库", err)
	}
	item := items[0]
	edited, err := s.EditTodo(t.Context(), domain.TodoEdit{ID: item.ID, Version: item.Version, Title: "human title", Notes: "private human notes", Owner: "human owner", Due: "human date", Status: "done"})
	if err != nil {
		t.Fatal(err)
	}
	candidates, err := s.RequirementCandidates(t.Context(), p, mails[1])
	if err != nil || len(candidates) != 1 || candidates[0].Title != "AI title" || strings.Contains(candidates[0].Evidence, "private") {
		t.Fatal("候选泄露人工字段", err)
	}
	out.Items = []domain.Requirement{{Title: "new title", Evidence: mails[1].Body, RelatedID: item.ID, Kind: "update"}}
	reserveAndCommit(t, s, p, mails[1], strings.Repeat("b", 64), out, candidates)
	details, err := s.TodoDetails(t.Context(), item.ID)
	if err != nil || details.Item.Title != "human title" || details.Item.Status != "done" || details.Item.Notes != "private human notes" || len(details.Proposals) != 1 {
		t.Fatal("AI 覆盖人工事项", err)
	}
	proposal := details.Proposals[0]
	if err := s.ResolveTodo(t.Context(), proposal.ID, item.Version, true); !errors.Is(err, domain.ErrTaskConflict) {
		t.Fatal("旧版本采用成功")
	}
	if err := s.ResolveTodo(t.Context(), proposal.ID, edited.Version, true); err != nil {
		t.Fatal(err)
	}
	details, err = s.TodoDetails(t.Context(), item.ID)
	if err != nil || details.Item.Owner != "human owner" || details.Item.Due != "human date" || details.Item.Notes != "private human notes" || details.Item.Status != "done" {
		t.Fatal("空建议不应清除人工字段", err)
	}
	run, _, err := s.CreateTaskRun(t.Context(), "manual", "", p.Revision, []string{mails[0].ID}, false, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if call, err := s.ReserveTaskMail(t.Context(), run.ID, mails[0], strings.Repeat("a", 64), false); err != nil || call {
		t.Fatal("成功邮件重复请求")
	}
	if _, err := s.db.Exec("DELETE FROM mail_message WHERE id=?", mails[0].ID); err != nil {
		t.Fatal(err)
	}
	details, err = s.TodoDetails(t.Context(), item.ID)
	if err != nil || len(details.Sources) != 2 {
		t.Fatal("同步删除丢失事项/引用", err)
	}
}

func TestTaskUnknownReceiptSurvivesRecoveryAndNeedsExplicitRetry(t *testing.T) {
	s, p, mails := taskRepoFixture(t)
	run, _, err := s.CreateTaskRun(t.Context(), "manual", "", p.Revision, []string{mails[0].ID, mails[1].ID}, false, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	key := strings.Repeat("c", 64)
	if call, err := s.ReserveTaskMail(t.Context(), run.ID, mails[0], key, false); err != nil || !call {
		t.Fatal(err)
	}
	if err := s.RecoverTaskRuns(t.Context()); err != nil {
		t.Fatal(err)
	}
	detail, err := s.TaskRunDetails(t.Context(), run.ID)
	if err != nil || detail.Run.Unknown != 1 || detail.Run.Pending != 1 || detail.Run.State != "interrupted" {
		t.Fatal("恢复误认为未发送", err)
	}
	other, _, err := s.CreateTaskRun(t.Context(), "manual", "", p.Revision, []string{mails[0].ID}, false, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if call, err := s.ReserveTaskMail(t.Context(), other.ID, mails[0], key, false); call || !errors.Is(err, domain.ErrTaskUnknown) {
		t.Fatal("未知结果自动重发", err)
	}
	retry, _, err := s.CreateTaskRun(t.Context(), "manual", "", p.Revision, []string{mails[0].ID}, true, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if call, err := s.ReserveTaskMail(t.Context(), retry.ID, mails[0], key, true); !call || err != nil {
		t.Fatal("显式重试无效", err)
	}
}

func TestRequirementCommitRejectsChangedBodyAtomically(t *testing.T) {
	s, p, mails := taskRepoFixture(t)
	source := mails[0]
	run, _, err := s.CreateTaskRun(t.Context(), "manual", "", p.Revision, []string{source.ID}, false, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	key := strings.Repeat("e", 64)
	if _, err := s.ReserveTaskMail(t.Context(), run.ID, source, key, false); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveMailBody(t.Context(), source.ID, domain.DecodedMail{Text: "changed during model request"}); err != nil {
		t.Fatal(err)
	}
	input := domain.RequirementInput{Source: domain.TranslatedText{Subject: source.Subject, Body: source.Body}}
	out := domain.RequirementOutput{Items: []domain.Requirement{{Title: "old", Evidence: source.Body, Kind: "new"}}}
	if err := s.CommitRequirements(t.Context(), run.ID, source, key, input, out); !errors.Is(err, domain.ErrTaskConflict) {
		t.Fatal("旧正文结果被保存", err)
	}
	todos, err := s.ListTodos(t.Context(), "all", 0)
	if err != nil || len(todos) != 0 {
		t.Fatal("失败事务留下部分事项")
	}
}
