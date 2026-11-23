package storage

import (
	"database/sql"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func DirSizeBytes(root string) int64 {
	var total int64
	_ = filepath.WalkDir(root, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if info, statErr := d.Info(); statErr == nil && info.Size() > 0 {
			total += info.Size()
		}
		return nil
	})
	return total
}

// CleanOrphanBlobs 扫描并回收不再被 messages / outbox_jobs / attachments 引用的孤儿 CAS 文件。
func (b *BlobStore) CleanOrphanBlobs(db *sql.DB) (int64, error) {
	if db == nil {
		return 0, nil
	}
	rawRefs := make(map[string]struct{})
	rows, err := db.Query(`SELECT raw_blob_sha256 FROM messages WHERE raw_blob_sha256 != ''
		UNION SELECT raw_mime_sha256 FROM outbox_jobs WHERE raw_mime_sha256 != ''`)
	if err == nil {
		for rows.Next() {
			var h string
			if rows.Scan(&h) == nil {
				rawRefs[strings.ToLower(h)] = struct{}{}
			}
		}
		_ = rows.Close()
	}

	attRefs := make(map[string]struct{})
	aRows, err := db.Query(`SELECT blob_sha256 FROM attachments WHERE blob_sha256 != '' AND status = 'ready'`)
	if err == nil {
		for aRows.Next() {
			var h string
			if aRows.Scan(&h) == nil {
				attRefs[strings.ToLower(h)] = struct{}{}
			}
		}
		_ = aRows.Close()
	}

	var freed int64
	_ = filepath.WalkDir(b.RawDir(), func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil || d.IsDir() || !strings.HasSuffix(d.Name(), ".eml.zst") {
			return nil
		}
		sha := strings.TrimSuffix(strings.ToLower(d.Name()), ".eml.zst")
		if _, ok := rawRefs[sha]; !ok {
			if info, err := d.Info(); err == nil {
				if os.Remove(path) == nil {
					freed += info.Size()
				}
			}
		}
		return nil
	})

	_ = filepath.WalkDir(b.AttachmentsDir(), func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil || d.IsDir() || strings.HasPrefix(d.Name(), ".") {
			return nil
		}
		sha := strings.ToLower(d.Name())
		if _, ok := attRefs[sha]; !ok {
			if info, err := d.Info(); err == nil {
				if os.Remove(path) == nil {
					freed += info.Size()
				}
			}
		}
		return nil
	})
	return freed, nil
}

// EnforceAttachmentLimit 按 last_access_at ASC 执行 LRU 附件淘汰，并将状态回退为 remote。
func (b *BlobStore) EnforceAttachmentLimit(db *sql.DB, limitBytes int64) (int64, error) {
	if db == nil || limitBytes <= 0 {
		return 0, nil
	}
	cur := DirSizeBytes(b.AttachmentsDir())
	if cur <= limitBytes {
		return 0, nil
	}
	type cand struct {
		id  string
		sha string
	}
	rows, err := db.Query(`SELECT id, blob_sha256 FROM attachments
		WHERE status = 'ready' AND is_inline = 0 AND blob_sha256 != ''
		ORDER BY last_access_at ASC, size_bytes DESC`)
	if err != nil {
		return 0, err
	}
	var list []cand
	for rows.Next() {
		var c cand
		if rows.Scan(&c.id, &c.sha) == nil {
			list = append(list, c)
		}
	}
	_ = rows.Close()

	var freed int64
	for _, c := range list {
		if cur-freed <= limitBytes {
			break
		}
		_, _ = db.Exec(`UPDATE attachments SET status = 'remote', local_path = '' WHERE id = ?`, c.id)
		var remaining int
		_ = db.QueryRow(`SELECT COUNT(1) FROM attachments WHERE blob_sha256 = ? AND status = 'ready'`, c.sha).Scan(&remaining)
		if remaining == 0 {
			if p, err := b.AttachmentPath(c.sha); err == nil {
				if st, statErr := os.Stat(p); statErr == nil && os.Remove(p) == nil {
					freed += st.Size()
				}
			}
		}
	}
	return freed, nil
}

func (b *BlobStore) ClearAllAttachmentCache(db *sql.DB) (int64, error) {
	if db != nil {
		_, _ = db.Exec(`UPDATE attachments SET status = 'remote', local_path = '' WHERE is_inline = 0 AND part_id != ''`)
		_, _ = db.Exec(`PRAGMA optimize;`)
	}
	return b.CleanOrphanBlobs(db)
}
