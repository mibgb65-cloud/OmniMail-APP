package contacts

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"omnimail/internal/apperr"
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
	all, err := ListContacts(db, ContactQuery{})
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
	for k, list := range byAlias {
		if len(list) < 2 {
			continue
		}
		for _, item := range list {
			seen[item.ID] = true
		}
		out = append(out, DuplicateGroupDTO{Key: "alias:" + k, Reason: "同一主邮箱 +alias 别名", Candidates: list})
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
			out = append(out, DuplicateGroupDTO{Key: "name:" + k, Reason: "同名多邮箱联系人", Candidates: unmerged})
		}
	}
	return out, nil
}

func MergeContacts(db *sql.DB, primaryID string, duplicateIDs []string) (ContactItemDTO, error) {
	all, err := ListContacts(db, ContactQuery{})
	if err != nil {
		return ContactItemDTO{}, err
	}
	byID := make(map[string]ContactItemDTO, len(all))
	for _, c := range all {
		byID[c.ID] = c
	}
	primary, ok := byID[primaryID]
	if !ok {
		return ContactItemDTO{}, apperr.New(apperr.CodeNotFound, "主联系人不存在")
	}

	tx, err := db.Begin()
	if err != nil {
		return ContactItemDTO{}, err
	}
	groupSet := append([]string{}, primary.Groups...)
	var altEmails []string
	for _, dupID := range duplicateIDs {
		if dupID == primaryID {
			continue
		}
		dup, exists := byID[dupID]
		if !exists {
			continue
		}
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
		primary.MailCount += dup.MailCount
		if dup.LastContactAt > primary.LastContactAt {
			primary.LastContactAt = dup.LastContactAt
		}
		for _, g := range dup.Groups {
			if !containsStr(groupSet, g) {
				groupSet = append(groupSet, g)
			}
		}
		if !strings.EqualFold(dup.Email, primary.Email) {
			altEmails = append(altEmails, dup.Email)
		}
		_, _ = tx.Exec(`DELETE FROM contacts WHERE id = ?`, dupID)
	}
	if len(altEmails) > 0 {
		suffix := "备用邮箱: " + strings.Join(altEmails, ", ")
		if !strings.Contains(primary.Note, suffix) {
			if strings.TrimSpace(primary.Note) == "" {
				primary.Note = suffix
			} else {
				primary.Note = primary.Note + " | " + suffix
			}
		}
	}
	grpJ, _ := json.Marshal(groupSet)
	vipInt := 0
	if primary.VIP {
		vipInt = 1
	}
	_, err = tx.Exec(`
		UPDATE contacts SET company=?, title=?, phone=?, note=?, groups_json=?, is_vip=?,
		       mail_count=?, last_contact_at=?, user_edited=1, updated_at=?
		WHERE id=?
	`, primary.Company, primary.Title, primary.Phone, primary.Note, string(grpJ), vipInt,
		primary.MailCount, primary.LastContactAt, time.Now().UnixMilli(), primary.ID)
	if err != nil {
		_ = tx.Rollback()
		return ContactItemDTO{}, err
	}
	if err := tx.Commit(); err != nil {
		return ContactItemDTO{}, err
	}
	primary.Groups = groupSet
	primary.LastContactText = formatContactTime(primary.LastContactAt)
	return primary, nil
}
