package contacts

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

func ListBlacklist(db *sql.DB) ([]BlacklistEntryDTO, error) {
	rows, err := db.Query(`
		SELECT id, target, kind, reason, blocked_count, added_at
		FROM blacklist_entries
		ORDER BY added_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]BlacklistEntryDTO, 0)
	for rows.Next() {
		var item BlacklistEntryDTO
		var addedMs int64
		if err := rows.Scan(&item.ID, &item.Target, &item.Kind, &item.Reason, &item.BlockedCount, &addedMs); err == nil {
			item.AddedAt = time.UnixMilli(addedMs).Format("2006-01-02")
			out = append(out, item)
		}
	}
	return out, nil
}

func AddBlacklist(db *sql.DB, target, kind, reason string) (BlacklistEntryDTO, error) {
	t := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(target, "@")))
	if t == "" {
		return BlacklistEntryDTO{}, apperr.New(apperr.CodeInvalidInput, "请输入需要拦截的发件人邮箱或域名")
	}
	k := strings.ToLower(strings.TrimSpace(kind))
	if k != "domain" && k != "address" {
		if strings.Contains(t, "@") {
			k = "address"
		} else {
			k = "domain"
		}
	}
	if k == "domain" && strings.Contains(t, "@") {
		t = t[strings.LastIndexByte(t, '@')+1:]
	}
	nowMs := time.Now().UnixMilli()
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	id := fmt.Sprintf("blk-%d-%s", nowMs, hex.EncodeToString(b))

	_, err := db.Exec(`
		INSERT INTO blacklist_entries(id, target, kind, reason, blocked_count, added_at)
		VALUES (?, ?, ?, ?, 0, ?)
		ON CONFLICT(target) DO UPDATE SET kind=excluded.kind, reason=excluded.reason
	`, id, t, k, strings.TrimSpace(reason), nowMs)
	if err != nil {
		return BlacklistEntryDTO{}, err
	}
	if k == "address" {
		_, _ = db.Exec(`UPDATE contacts SET is_blocked=1, updated_at=? WHERE LOWER(email)=?`, nowMs, t)
	}
	var saved BlacklistEntryDTO
	var addedMs int64
	_ = db.QueryRow(`SELECT id, target, kind, reason, blocked_count, added_at FROM blacklist_entries WHERE target=?`, t).
		Scan(&saved.ID, &saved.Target, &saved.Kind, &saved.Reason, &saved.BlockedCount, &addedMs)
	saved.AddedAt = time.UnixMilli(addedMs).Format("2006-01-02")
	return saved, nil
}

func RemoveBlacklist(db *sql.DB, id string) error {
	var target, kind string
	_ = db.QueryRow(`SELECT target, kind FROM blacklist_entries WHERE id=?`, id).Scan(&target, &kind)
	if _, err := db.Exec(`DELETE FROM blacklist_entries WHERE id=?`, id); err != nil {
		return err
	}
	if kind == "address" && target != "" {
		_, _ = db.Exec(`UPDATE contacts SET is_blocked=0, updated_at=? WHERE LOWER(email)=?`, time.Now().UnixMilli(), target)
	}
	return nil
}

// CheckAndCountBlocked 在新邮件入库事务最前段校验发件人地址及域名/子域名黑名单并原子累加拦截计数。
func CheckAndCountBlocked(tx *sql.Tx, senderEmail string) bool {
	email := strings.ToLower(strings.TrimSpace(senderEmail))
	at := strings.LastIndexByte(email, '@')
	if at <= 0 || at == len(email)-1 {
		return false
	}
	domain := email[at+1:]
	rows, err := tx.Query(`SELECT id, target, kind FROM blacklist_entries`)
	if err != nil {
		return false
	}
	var hitID string
	for rows.Next() {
		var id, target, kind string
		if rows.Scan(&id, &target, &kind) != nil {
			continue
		}
		target = strings.ToLower(strings.TrimSpace(target))
		if kind == "address" && email == target {
			hitID = id
			break
		}
		if kind == "domain" && (domain == target || strings.HasSuffix(domain, "."+target)) {
			hitID = id
			break
		}
	}
	_ = rows.Close()
	if hitID != "" {
		_, _ = tx.Exec(`UPDATE blacklist_entries SET blocked_count = blocked_count + 1 WHERE id = ?`, hitID)
		return true
	}
	return false
}
