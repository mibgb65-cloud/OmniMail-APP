package rules

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
)

type EvalOutcome struct {
	OverrideFolder string
	MarkRead       bool
	MarkStarred    bool
	AddLabelIDs    []string
	HitRuleIDs     []string
}

type ruleEvalTarget struct {
	accountID string
	sender    string
	subject   string
	recipient string
	body      string
	hasAtt    bool
	attExts   []string
}

func EvaluateOnIncoming(tx *sql.Tx, accountID string, parsed *mailproto.ParsedEmail) EvalOutcome {
	var out EvalOutcome
	if tx == nil || parsed == nil {
		return out
	}
	rows, err := tx.Query(`
		SELECT id, match_mode, account_scope, conditions_json, actions_json, stop_matching
		FROM inbox_rules WHERE enabled = 1 ORDER BY priority ASC, updated_at ASC
	`)
	if err != nil {
		return out
	}
	var loaded []InboxRuleDTO
	for rows.Next() {
		var r InboxRuleDTO
		var condJ, actJ string
		var stopInt int
		if rows.Scan(&r.ID, &r.MatchMode, &r.AccountScope, &condJ, &actJ, &stopInt) == nil {
			r.StopMatching = stopInt != 0
			_ = json.Unmarshal([]byte(condJ), &r.Conditions)
			_ = json.Unmarshal([]byte(actJ), &r.Actions)
			loaded = append(loaded, r)
		}
	}
	_ = rows.Close()

	var recips, exts []string
	for _, a := range append(append([]mailproto.EmailAddress{}, parsed.To...), parsed.Cc...) {
		recips = append(recips, a.Email)
	}
	for _, att := range parsed.Attachments {
		if !att.IsInline {
			exts = append(exts, strings.ToLower(att.Ext))
		}
	}
	target := ruleEvalTarget{
		accountID: accountID,
		sender:    parsed.Sender.Name + " " + parsed.Sender.Email,
		subject:   parsed.Subject,
		recipient: strings.Join(recips, " "),
		body:      parsed.BodyText,
		hasAtt:    len(exts) > 0,
		attExts:   exts,
	}

	for _, r := range loaded {
		if !matchRuleTarget(r, target) {
			continue
		}
		out.HitRuleIDs = append(out.HitRuleIDs, r.ID)
		applyActionsToOutcome(&out, r.Actions)
		if r.StopMatching {
			break
		}
	}
	return out
}

func RecordRuleHits(db *sql.DB, msgID string, ruleIDs []string) {
	nowMs := time.Now().UnixMilli()
	for _, rid := range ruleIDs {
		_, _ = db.Exec(`INSERT INTO rule_hit_logs(rule_id, message_id, hit_at) VALUES (?, ?, ?)`, rid, msgID, nowMs)
	}
}

func PreviewRule(db *sql.DB, rule InboxRuleDTO) (RulePreviewResult, error) {
	NormalizeRuleDTO(&rule)
	sinceMs := time.Now().Add(-30 * 24 * time.Hour).UnixMilli()
	rows, err := db.Query(`
		SELECT id, account_id, sender_name, sender_email, to_json, subject, body_text, has_attachments
		FROM messages WHERE received_at >= ? ORDER BY received_at DESC LIMIT 400
	`, sinceMs)
	if err != nil {
		return RulePreviewResult{}, err
	}
	defer rows.Close()

	res := RulePreviewResult{Samples: []RulePreviewSample{}}
	for rows.Next() {
		var id, accID, sName, sEmail, toJ, subj, body string
		var hasAtt int
		if rows.Scan(&id, &accID, &sName, &sEmail, &toJ, &subj, &body, &hasAtt) != nil {
			continue
		}
		t := ruleEvalTarget{
			accountID: accID, sender: sName + " " + sEmail, subject: subj,
			recipient: toJ, body: body, hasAtt: hasAtt != 0,
		}
		if matchRuleTarget(rule, t) {
			res.HitCount++
			if len(res.Samples) < 5 {
				res.Samples = append(res.Samples, RulePreviewSample{ID: id, Subject: subj, SenderEmail: sEmail})
			}
		}
	}
	return res, nil
}

func RunRuleNow(db *sql.DB, ruleID string) (int, error) {
	all, err := ListRules(db)
	if err != nil {
		return 0, err
	}
	var targetRule *InboxRuleDTO
	for i := range all {
		if all[i].ID == ruleID {
			targetRule = &all[i]
			break
		}
	}
	if targetRule == nil {
		return 0, apperr.New(apperr.CodeNotFound, "未找到指定的自动化规则")
	}

	rows, err := db.Query(`
		SELECT id, account_id, sender_name, sender_email, to_json, subject, body_text, has_attachments
		FROM messages WHERE folder = 'inbox'
	`)
	if err != nil {
		return 0, err
	}
	var hitIDs []string
	for rows.Next() {
		var id, accID, sName, sEmail, toJ, subj, body string
		var hasAtt int
		if rows.Scan(&id, &accID, &sName, &sEmail, &toJ, &subj, &body, &hasAtt) == nil {
			if matchRuleTarget(*targetRule, ruleEvalTarget{
				accountID: accID, sender: sName + " " + sEmail, subject: subj,
				recipient: toJ, body: body, hasAtt: hasAtt != 0,
			}) {
				hitIDs = append(hitIDs, id)
			}
		}
	}
	_ = rows.Close()

	var out EvalOutcome
	applyActionsToOutcome(&out, targetRule.Actions)
	for _, mid := range hitIDs {
		if out.OverrideFolder != "" {
			_, _ = db.Exec(`UPDATE messages SET folder = ? WHERE id = ?`, out.OverrideFolder, mid)
		}
		if out.MarkRead {
			_, _ = db.Exec(`UPDATE messages SET is_unread = 0 WHERE id = ?`, mid)
		}
		if out.MarkStarred {
			_, _ = db.Exec(`UPDATE messages SET is_starred = 1 WHERE id = ?`, mid)
		}
		for _, lid := range out.AddLabelIDs {
			_, _ = db.Exec(`INSERT OR IGNORE INTO message_labels(message_id, label_id) VALUES (?, ?)`, mid, lid)
		}
		RecordRuleHits(db, mid, []string{targetRule.ID})
	}
	return len(hitIDs), nil
}
