package repository

import "context"

// MailCounts 一次聚合所有文件夹的本地记录，避免用已加载的一页冒充整个邮箱的同步数量。
func (s *Store) MailCounts(ctx context.Context) (map[string]int, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT account_id, COUNT(*) FROM mail_message GROUP BY account_id")
	if err != nil {
		return nil, storageError("统计本地邮件", err)
	}
	defer rows.Close()
	counts := make(map[string]int)
	for rows.Next() {
		var id string
		var count int
		if err := rows.Scan(&id, &count); err != nil {
			return nil, storageError("读取邮件计数", err)
		}
		counts[id] = count
	}
	if err := rows.Err(); err != nil {
		return nil, storageError("遍历邮件计数", err)
	}
	return counts, nil
}
