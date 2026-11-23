package rules

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

func ListRules(db *sql.DB) ([]InboxRuleDTO, error) {
	sevenDaysAgo := time.Now().Add(-7 * 24 * time.Hour).UnixMilli()
	_, _ = db.Exec(`DELETE FROM rule_hit_logs WHERE hit_at < ?`, sevenDaysAgo)

	rows, err := db.Query(`
		SELECT r.id, r.name, r.enabled, r.priority, r.match_mode, r.account_scope,
		       r.conditions_json, r.actions_json, r.stop_matching,
		       (SELECT COUNT(1) FROM rule_hit_logs l WHERE l.rule_id = r.id AND l.hit_at >= ?)
		FROM inbox_rules r
		ORDER BY r.priority ASC, r.updated_at ASC
	`, sevenDaysAgo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]InboxRuleDTO, 0)
	for rows.Next() {
		var item InboxRuleDTO
		var enabledInt, stopInt int
		var condJ, actJ string
		if err := rows.Scan(
			&item.ID, &item.Name, &enabledInt, &item.Priority, &item.MatchMode, &item.AccountScope,
			&condJ, &actJ, &stopInt, &item.HitsLast7Days,
		); err != nil {
			continue
		}
		item.Enabled = enabledInt != 0
		item.StopMatching = stopInt != 0
		_ = json.Unmarshal([]byte(condJ), &item.Conditions)
		_ = json.Unmarshal([]byte(actJ), &item.Actions)
		for _, c := range item.Conditions {
			if c.Field == "attachment_ext" {
				item.AttachmentExt = c.Value
			}
		}
		NormalizeRuleDTO(&item)
		out = append(out, item)
	}
	return out, nil
}

func SaveRule(db *sql.DB, in InboxRuleDTO) (InboxRuleDTO, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return InboxRuleDTO{}, apperr.New(apperr.CodeInvalidInput, "请输入规则名称")
	}
	NormalizeRuleDTO(&in)
	if len(in.Conditions) == 0 || strings.TrimSpace(in.Conditions[0].Value) == "" && in.Conditions[0].Field != "has_attachment" {
		return InboxRuleDTO{}, apperr.New(apperr.CodeInvalidInput, "请填写至少一条有效匹配条件")
	}
	if in.ID == "" {
		b := make([]byte, 4)
		_, _ = rand.Read(b)
		in.ID = fmt.Sprintf("rule-%d-%s", time.Now().UnixMilli(), hex.EncodeToString(b))
	}
	if in.Priority <= 0 {
		var maxP int
		_ = db.QueryRow(`SELECT COALESCE(MAX(priority), 0) FROM inbox_rules`).Scan(&maxP)
		in.Priority = maxP + 10
	}
	condJ, _ := json.Marshal(in.Conditions)
	actJ, _ := json.Marshal(in.Actions)
	enInt, stopInt := 0, 0
	if in.Enabled {
		enInt = 1
	}
	if in.StopMatching {
		stopInt = 1
	}
	nowMs := time.Now().UnixMilli()
	_, err := db.Exec(`
		INSERT INTO inbox_rules(id, name, enabled, priority, match_mode, account_scope, conditions_json, actions_json, stop_matching, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, enabled=excluded.enabled, priority=excluded.priority,
			match_mode=excluded.match_mode, account_scope=excluded.account_scope,
			conditions_json=excluded.conditions_json, actions_json=excluded.actions_json,
			stop_matching=excluded.stop_matching, updated_at=excluded.updated_at
	`, in.ID, in.Name, enInt, in.Priority, in.MatchMode, in.AccountScope, string(condJ), string(actJ), stopInt, nowMs)
	if err != nil {
		return InboxRuleDTO{}, err
	}
	return in, nil
}

func DeleteRule(db *sql.DB, id string) error {
	_, err := db.Exec(`DELETE FROM inbox_rules WHERE id = ?`, strings.TrimSpace(id))
	return err
}

func ReorderRules(db *sql.DB, ids []string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for i, id := range ids {
		if _, err := tx.Exec(`UPDATE inbox_rules SET priority = ? WHERE id = ?`, (i+1)*10, id); err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}
