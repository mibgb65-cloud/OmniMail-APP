package storage

import (
	"database/sql"
	"fmt"
	"time"
)

const draftInlineImagesDDL = `
CREATE TABLE IF NOT EXISTS draft_inline_images (
	id          TEXT PRIMARY KEY,
	draft_id    TEXT NOT NULL,
	content_id  TEXT NOT NULL,
	filename    TEXT NOT NULL DEFAULT '',
	mime_type   TEXT NOT NULL DEFAULT 'image/png',
	size_bytes  INTEGER NOT NULL DEFAULT 0,
	blob_sha256 TEXT NOT NULL,
	created_at  INTEGER NOT NULL
);`

const draftInlineImagesIdxDDL = `
CREATE INDEX IF NOT EXISTS idx_draft_inline_draft ON draft_inline_images(draft_id);`

// migrateDraftInlineImages 幂等建表记录草稿内嵌图片与 CAS 哈希映射，避免在草稿 JSON 存放超大 base64。
func migrateDraftInlineImages(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	if _, err := tx.Exec(draftInlineImagesDDL); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("创建草稿内嵌图表失败: %w", err)
	}
	if _, err := tx.Exec(draftInlineImagesIdxDDL); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("创建草稿内嵌图索引失败: %w", err)
	}
	if _, err := tx.Exec(`INSERT OR REPLACE INTO schema_migrations(version, applied_at) VALUES (4, ?)`, time.Now().UnixMilli()); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
