package contacts

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

func canonicalEmailKey(email string) string {
	low := strings.ToLower(strings.TrimSpace(email))
	at := strings.IndexByte(low, '@')
	if at <= 0 {
		return low
	}
	local, domain := low[:at], low[at:]
	if plus := strings.IndexByte(local, '+'); plus > 0 {
		local = local[:plus]
	}
	return local + domain
}

func FindDuplicateContacts(db *sql.DB) ([]DuplicateGroupDTO, error) {
	return findDuplicateContacts(db)
}

func findDuplicateContacts(db contactReader) ([]DuplicateGroupDTO, error) {
	all, err := listContacts(db, ContactQuery{}, -1)
	if err != nil {
		return nil, err
	}
	ignored, err := ignoredDuplicateKeys(db)
	if err != nil {
		return nil, err
	}
	byName := make(map[string][]ContactItemDTO)
	byAlias := make(map[string][]ContactItemDTO)
	for _, c := range all {
		normName := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(c.Name), " ", ""))
		if len(normName) >= 2 && !strings.Contains(normName, "@") {
			byName[normName] = append(byName[normName], c)
		}
		aliasKey := canonicalEmailKey(c.Email)
		byAlias[aliasKey] = append(byAlias[aliasKey], c)
	}

	seen := make(map[string]bool)
	out := make([]DuplicateGroupDTO, 0)
	addGroup := func(kind, reason string, list []ContactItemDTO) {
		ids := make([]string, 0, len(list))
		hasRelay := false
		for _, item := range list {
			ids = append(ids, item.ID+"\x00"+strings.ToLower(item.Email))
			hasRelay = hasRelay || looksLikeRelay(item.Email)
		}
		sort.Strings(ids)
		data, _ := json.Marshal([]any{kind, ids})
		key := fmt.Sprintf("%x", sha256.Sum256(data))
		if ignored[key] {
			return
		}
		sort.Slice(list, func(i, j int) bool {
			if list[i].MailCount != list[j].MailCount {
				return list[i].MailCount > list[j].MailCount
			}
			return list[i].ID < list[j].ID
		})
		out = append(out, DuplicateGroupDTO{Key: key, Reason: reason, Candidates: list, HasRelay: hasRelay})
	}
	for k, list := range byAlias {
		if len(list) < 2 {
			continue
		}
		for _, item := range list {
			seen[item.ID] = true
		}
		addGroup("alias:"+k, "同一主邮箱 +alias 别名", list)
	}
	for k, list := range byName {
		if len(list) < 2 {
			continue
		}
		var unmerged []ContactItemDTO
		for _, item := range list {
			if !seen[item.ID] {
				unmerged = append(unmerged, item)
			}
		}
		if len(unmerged) >= 2 {
			addGroup("name:"+k, "同名多邮箱联系人", unmerged)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if len(out[i].Candidates) != len(out[j].Candidates) {
			return len(out[i].Candidates) > len(out[j].Candidates)
		}
		return out[i].Key < out[j].Key
	})
	return out, nil
}

func mergeContactGroup(tx *sql.Tx, primary ContactItemDTO, duplicates []ContactItemDTO) (ContactItemDTO, error) {
	groupSet := append([]string{}, primary.Groups...)
	for _, dup := range duplicates {
		if primary.Company == "" {
			primary.Company = dup.Company
		}
		if primary.Title == "" {
			primary.Title = dup.Title
		}
		if primary.Phone == "" {
			primary.Phone = dup.Phone
		}
		if primary.Note == "" {
			primary.Note = dup.Note
		}
		primary.VIP = primary.VIP || dup.VIP
		primary.Blocked = primary.Blocked || dup.Blocked
		primary.MailCount += dup.MailCount
		if dup.LastContactAt > primary.LastContactAt {
			primary.LastContactAt = dup.LastContactAt
		}
		for _, g := range dup.Groups {
			if !containsStr(groupSet, g) {
				groupSet = append(groupSet, g)
			}
		}
		if _, err := tx.Exec(`UPDATE contact_aliases SET contact_id=? WHERE contact_id=?`, primary.ID, dup.ID); err != nil {
			return ContactItemDTO{}, err
		}
		if !strings.EqualFold(dup.Email, primary.Email) {
			if _, err := tx.Exec(`INSERT INTO contact_aliases(email, contact_id) VALUES (?, ?)`, dup.Email, primary.ID); err != nil {
				return ContactItemDTO{}, err
			}
			primary.AlternateEmails = append(primary.AlternateEmails, dup.Email)
		}
		primary.AlternateEmails = append(primary.AlternateEmails, dup.AlternateEmails...)
		if _, err := tx.Exec(`DELETE FROM contacts WHERE id=?`, dup.ID); err != nil {
			return ContactItemDTO{}, err
		}
	}
	grpJ, _ := json.Marshal(groupSet)
	_, err := tx.Exec(`
		UPDATE contacts SET company=?, title=?, phone=?, note=?, groups_json=?, is_vip=?, is_blocked=?,
		       mail_count=?, last_contact_at=?, user_edited=1, updated_at=?
		WHERE id=?
	`, primary.Company, primary.Title, primary.Phone, primary.Note, string(grpJ), primary.VIP, primary.Blocked,
		primary.MailCount, primary.LastContactAt, time.Now().UnixMilli(), primary.ID)
	if err != nil {
		return ContactItemDTO{}, err
	}
	primary.Groups = groupSet
	primary.LastContactText = formatContactTime(primary.LastContactAt)
	return primary, nil
}

func looksLikeRelay(email string) bool {
	local, domain, ok := strings.Cut(strings.ToLower(email), "@")
	if !ok {
		return false
	}
	if strings.Contains(local, "noreply") || strings.Contains(local, "no-reply") ||
		strings.Contains(local, "no_reply") || domain == "privaterelay.appleid.com" {
		return true
	}
	// iCloud 转发地址常以 _at_ 连接原域，尾段带随机字母或数字。
	return domain == "icloud.com" && strings.Contains(local, "_at_")
}
