package domain

import "context"

type TaskRepository interface {
	ReadTaskPreferences(context.Context) (TaskPreferences, error)
	WriteTaskPreferences(context.Context, TaskPreferences) error
	ListTodos(context.Context, string, int) ([]Todo, error)
	TodoCounts(context.Context) (TodoCounts, error)
	EditTodo(context.Context, TodoEdit) (Todo, error)
	DeleteTodo(context.Context, string, int) error
	TodoDetails(context.Context, string) (TodoDetails, error)
	ResolveTodo(context.Context, string, int, bool) error
	TodoSource(context.Context, string) (TodoSource, int, error)
	ReadTaskMail(context.Context, string) (TaskMail, error)
	RequirementCandidates(context.Context, TaskPreferences, TaskMail) ([]RequirementCandidate, error)
	PendingTaskMails(context.Context, TaskPreferences) ([]string, int, int, error)
	CreateTaskRun(context.Context, string, string, string, []string, bool, int, int) (TaskRun, bool, error)
	TaskRuns(context.Context) ([]TaskRun, error)
	ResumableTaskRun(context.Context, string, bool) (*TaskRun, error)
	TaskRunDetails(context.Context, string) (TaskRunDetails, error)
	NextTaskMail(context.Context, string) (TaskRunMail, bool, error)
	ReserveTaskMail(context.Context, string, TaskMail, string, bool) (bool, error)
	CommitRequirements(context.Context, string, TaskMail, string, RequirementInput, RequirementOutput) error
	FailTaskMail(context.Context, string, string, string, bool) error
	FinishTaskRun(context.Context, string, string, string) error
	RecoverTaskRuns(context.Context) error
	MarkTaskRunning(context.Context, string) error
	FillTaskRun(context.Context, string, []string, int, int, bool) error
}
