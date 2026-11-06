package repository

import (
	"context"

	"omnimail/desktop/internal/domain"
)

func (s *Store) TodoCounts(ctx context.Context) (domain.TodoCounts, error) {
	var value domain.TodoCounts
	rows, err := s.db.QueryContext(ctx, "SELECT status,count(*) FROM todo_item GROUP BY status")
	if err != nil {
		return value, domain.ErrTaskStorage
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if rows.Scan(&status, &count) != nil || count < 0 || count > 10000 {
			return value, domain.ErrTaskStorage
		}
		switch status {
		case "suggested":
			value.Suggested = count
		case "open":
			value.Open = count
		case "waiting":
			value.Waiting = count
		case "done":
			value.Done = count
		case "dismissed":
			value.Dismissed = count
		default:
			return value, domain.ErrTaskStorage
		}
		value.All += count
	}
	if rows.Err() != nil || value.All > 10000 {
		return domain.TodoCounts{}, domain.ErrTaskStorage
	}
	return value, nil
}
