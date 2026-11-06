package bridge

import (
	"context"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/service"
)

type TasksBridge struct{ service *service.Tasks }

func NewTasksBridge(s *service.Tasks) *TasksBridge { return &TasksBridge{service: s} }
func (b *TasksBridge) List(ctx context.Context, status string, offset int) ([]domain.Todo, error) {
	return b.service.List(ctx, status, offset)
}
func (b *TasksBridge) Counts(ctx context.Context) (domain.TodoCounts, error) {
	return b.service.Counts(ctx)
}
func (b *TasksBridge) Edit(ctx context.Context, input domain.TodoEdit) (domain.Todo, error) {
	return b.service.Edit(ctx, input)
}
func (b *TasksBridge) Delete(ctx context.Context, id string, version int) error {
	return b.service.Delete(ctx, id, version)
}
func (b *TasksBridge) Detail(ctx context.Context, id string) (domain.TodoDetails, error) {
	return b.service.Detail(ctx, id)
}
func (b *TasksBridge) Resolve(ctx context.Context, id string, version int, accept bool) error {
	return b.service.Resolve(ctx, id, version, accept)
}
func (b *TasksBridge) Source(ctx context.Context, id string) (domain.TodoSourceView, error) {
	return b.service.Source(ctx, id)
}
func (b *TasksBridge) Preferences(ctx context.Context) (domain.TaskPreferences, error) {
	return b.service.Preferences(ctx)
}
func (b *TasksBridge) SetPreferences(ctx context.Context, input domain.TaskPreferencesInput) (domain.TaskPreferences, error) {
	return b.service.SavePreferences(ctx, input)
}
func (b *TasksBridge) RunBatch(ctx context.Context, input domain.TaskBatchInput) (string, error) {
	return b.service.RunBatch(ctx, input)
}
func (b *TasksBridge) CheckBatch(ctx context.Context, input domain.TaskBatchInput) error {
	return b.service.CheckBatch(ctx, input)
}
func (b *TasksBridge) RunPending(ctx context.Context) (string, error) {
	return b.service.RunPending(ctx)
}
func (b *TasksBridge) Resume(ctx context.Context, id string) error        { return b.service.Resume(ctx, id) }
func (b *TasksBridge) Stop()                                              { b.service.Stop() }
func (b *TasksBridge) State() service.TaskState                           { return b.service.State() }
func (b *TasksBridge) Runs(ctx context.Context) ([]domain.TaskRun, error) { return b.service.Runs(ctx) }
func (b *TasksBridge) RunDetail(ctx context.Context, id string) (domain.TaskRunDetails, error) {
	return b.service.RunDetail(ctx, id)
}
