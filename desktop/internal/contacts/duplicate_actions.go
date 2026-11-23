package contacts

import (
	"database/sql"
	"encoding/hex"
	"strings"

	"omnimail/internal/apperr"
)

func ignoredDuplicateKeys(db contactReader) (map[string]bool, error) {
	rows, err := db.Query(`SELECT group_key FROM contact_duplicate_ignores`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := make(map[string]bool)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys[key] = true
	}
	return keys, rows.Err()
}

func validDuplicateKey(key string) bool {
	if len(key) != 64 {
		return false
	}
	_, err := hex.DecodeString(key)
	return err == nil
}

func duplicateChanged() error {
	return apperr.New(apperr.CodeInvalidInput, "重复联系人已变化，请刷新列表后重试")
}

func IgnoreDuplicateContacts(db *sql.DB, key string) error {
	if !validDuplicateKey(key) {
		return duplicateChanged()
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	groups, err := findDuplicateContacts(tx)
	if err != nil {
		return err
	}
	for _, group := range groups {
		if group.Key == key {
			if _, err := tx.Exec(`INSERT INTO contact_duplicate_ignores(group_key) VALUES (?)`, key); err != nil {
				return err
			}
			return tx.Commit()
		}
	}
	return duplicateChanged()
}

func BatchMergeContacts(db *sql.DB, plans []ContactMergeGroup) (ContactMergeResult, error) {
	var out ContactMergeResult
	if len(plans) == 0 || len(plans) > 500 {
		return out, apperr.New(apperr.CodeInvalidInput, "请选择 1 至 500 组重复联系人")
	}
	tx, err := db.Begin()
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	groups, err := findDuplicateContacts(tx)
	if err != nil {
		return out, err
	}
	byKey := make(map[string][]ContactItemDTO, len(groups))
	for _, group := range groups {
		byKey[group.Key] = group.Candidates
	}
	for _, plan := range plans {
		list := byKey[plan.GroupKey]
		delete(byKey, plan.GroupKey)
		primary, duplicates, err := validateMergeGroup(list, plan)
		if err != nil {
			return ContactMergeResult{}, err
		}
		if _, err := mergeContactGroup(tx, primary, duplicates); err != nil {
			return ContactMergeResult{}, err
		}
		out.Groups++
		out.Removed += len(duplicates)
	}
	if err := tx.Commit(); err != nil {
		return ContactMergeResult{}, err
	}
	return out, nil
}

func validateMergeGroup(list []ContactItemDTO, plan ContactMergeGroup) (ContactItemDTO, []ContactItemDTO, error) {
	if !validDuplicateKey(plan.GroupKey) || len(list) < 2 || len(plan.DuplicateIDs) == 0 ||
		len(plan.DuplicateIDs) >= len(list) || len(plan.DuplicateIDs) > 5000 {
		return ContactItemDTO{}, nil, duplicateChanged()
	}
	byID := make(map[string]ContactItemDTO, len(list))
	for _, candidate := range list {
		byID[candidate.ID] = candidate
	}
	primary, exists := byID[plan.PrimaryID]
	if !exists || !validContactID(plan.PrimaryID) {
		return ContactItemDTO{}, nil, duplicateChanged()
	}
	delete(byID, plan.PrimaryID)
	duplicates := make([]ContactItemDTO, 0, len(plan.DuplicateIDs))
	for _, id := range plan.DuplicateIDs {
		item, exists := byID[id]
		if !exists || !validContactID(id) {
			return ContactItemDTO{}, nil, duplicateChanged()
		}
		delete(byID, id)
		duplicates = append(duplicates, item)
	}
	return primary, duplicates, nil
}

func validContactID(id string) bool {
	return len(id) > 0 && len(id) <= 128 && strings.TrimSpace(id) == id && !strings.ContainsRune(id, 0)
}
