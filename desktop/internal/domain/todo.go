package domain

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	ErrTaskInput    = errors.New("TASK_INVALID_INPUT")
	ErrTaskConflict = errors.New("TASK_CONFLICT")
	ErrTaskNotFound = errors.New("TASK_NOT_FOUND")
	ErrTaskConsent  = errors.New("TASK_CONSENT_REQUIRED")
	ErrTaskConfig   = errors.New("TASK_CONFIG_CHANGED")
	ErrTaskBusy     = errors.New("TASK_BUSY")
	ErrTaskUnknown  = errors.New("TASK_OUTCOME_UNKNOWN")
	ErrTaskStorage  = errors.New("TASK_STORAGE_FAILED")
	ErrTaskLimit    = errors.New("TASK_LIMIT_REACHED")
)

func TaskText(value string, maximum int, required bool) bool {
	return utf8.ValidString(value) && len(value) <= maximum &&
		(!required || strings.TrimSpace(value) != "") &&
		!strings.ContainsFunc(value, func(r rune) bool { return unicode.IsControl(r) && r != '\n' && r != '\t' })
}

func ValidTodoStatus(value string) bool {
	switch value {
	case "suggested", "open", "waiting", "done", "dismissed":
		return true
	}
	return false
}

type Todo struct {
	ID        string `json:"id"`
	AccountID string `json:"accountId"`
	Title     string `json:"title"`
	Notes     string `json:"notes"`
	Owner     string `json:"owner"`
	Due       string `json:"due"`
	Status    string `json:"status"`
	Version   int    `json:"version"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

type TodoCounts struct {
	All       int `json:"all"`
	Suggested int `json:"suggested"`
	Open      int `json:"open"`
	Waiting   int `json:"waiting"`
	Done      int `json:"done"`
	Dismissed int `json:"dismissed"`
}

type TodoEdit struct {
	ID        string `json:"id"`
	AccountID string `json:"accountId"`
	Version   int    `json:"version"`
	Title     string `json:"title"`
	Notes     string `json:"notes"`
	Owner     string `json:"owner"`
	Due       string `json:"due"`
	Status    string `json:"status"`
}

func (e TodoEdit) Validate() error {
	if (e.ID != "" && !ValidAccountID(e.ID)) || (e.AccountID != "" && !ValidAccountID(e.AccountID)) ||
		e.Version < 0 || e.Version > 1_000_000_000 || !ValidTodoStatus(e.Status) ||
		!TaskText(e.Title, 1000, true) || !TaskText(e.Notes, 4096, false) ||
		!TaskText(e.Owner, 200, false) || !TaskText(e.Due, 100, false) {
		return ErrTaskInput
	}
	return nil
}

type TodoSource struct {
	ID         string `json:"id"`
	TodoID     string `json:"todoId"`
	MailID     string `json:"mailId"`
	AccountID  string `json:"accountId"`
	Subject    string `json:"subject"`
	Evidence   string `json:"evidence"`
	ReceivedAt int64  `json:"receivedAt"`
	Available  bool   `json:"available"`
}

type TodoProposal struct {
	ID        string `json:"id"`
	TodoID    string `json:"todoId"`
	SourceID  string `json:"sourceId"`
	Kind      string `json:"kind"`
	Title     string `json:"title"`
	Owner     string `json:"owner"`
	Due       string `json:"due"`
	Reason    string `json:"reason"`
	Evidence  string `json:"evidence"`
	State     string `json:"state"`
	CreatedAt int64  `json:"createdAt"`
}

type TodoDetails struct {
	Item      Todo           `json:"item"`
	Sources   []TodoSource   `json:"sources"`
	Proposals []TodoProposal `json:"proposals"`
	Truncated bool           `json:"truncated"`
}

type TodoSourceView struct {
	Source  TodoSource `json:"source"`
	Body    string     `json:"body"`
	Changed bool       `json:"changed"`
	Error   string     `json:"error"`
}
