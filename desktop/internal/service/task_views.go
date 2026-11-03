package service

import (
	"context"
	"errors"

	"omnimail/desktop/internal/domain"
)

func (s *Tasks) List(ctx context.Context, status string, offset int) ([]domain.Todo, error) {
	return s.store.ListTodos(ctx, status, offset)
}
func (s *Tasks) Edit(ctx context.Context, input domain.TodoEdit) (domain.Todo, error) {
	return s.store.EditTodo(ctx, input)
}
func (s *Tasks) Delete(ctx context.Context, id string, version int) error {
	return s.store.DeleteTodo(ctx, id, version)
}
func (s *Tasks) Detail(ctx context.Context, id string) (domain.TodoDetails, error) {
	return s.store.TodoDetails(ctx, id)
}
func (s *Tasks) Resolve(ctx context.Context, id string, version int, accept bool) error {
	return s.store.ResolveTodo(ctx, id, version, accept)
}
func (s *Tasks) Runs(ctx context.Context) ([]domain.TaskRun, error) { return s.store.TaskRuns(ctx) }
func (s *Tasks) RunDetail(ctx context.Context, id string) (domain.TaskRunDetails, error) {
	return s.store.TaskRunDetails(ctx, id)
}
func (s *Tasks) Source(ctx context.Context, id string) (domain.TodoSourceView, error) {
	source, revision, err := s.store.TodoSource(ctx, id)
	view := domain.TodoSourceView{Source: source}
	if err != nil {
		return view, err
	}
	if !source.Available {
		return view, nil
	}
	mail, err := s.store.ReadTaskMail(ctx, source.MailID)
	if err != nil && !errors.Is(err, domain.ErrTaskNotFound) {
		return view, err
	}
	if err != nil || mail.AccountID != source.AccountID {
		view.Source.Available = false
		return view, nil
	}
	text, err := translationText(mail.MailDetail)
	if err != nil {
		view.Error = domain.ErrAINotReady.Error()
		return view, nil
	}
	view.Body = text.Body
	view.Changed = mail.BodyRevision != revision
	return view, nil
}
