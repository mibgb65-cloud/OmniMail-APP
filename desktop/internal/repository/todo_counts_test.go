package repository

import (
	"fmt"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestTodoCountsAreGlobalAndIndependentOfLoadedPage(t *testing.T) {
	s := openTestStore(t)
	for i := 0; i < 101; i++ {
		status := "open"
		if i == 100 {
			status = "suggested"
		}
		if _, err := s.EditTodo(t.Context(), domain.TodoEdit{Title: fmt.Sprintf("synthetic %d", i), Status: status}); err != nil {
			t.Fatal(err)
		}
	}
	counts, err := s.TodoCounts(t.Context())
	if err != nil || counts.All != 101 || counts.Open != 100 || counts.Suggested != 1 {
		t.Fatal("计数不完整", counts, err)
	}
	page, err := s.ListTodos(t.Context(), "all", 0)
	if err != nil || len(page) != 100 {
		t.Fatal("页限制失效")
	}
}
