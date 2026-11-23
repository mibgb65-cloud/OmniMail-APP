package rules

import (
	"regexp"
	"strings"
)

func applyActionsToOutcome(out *EvalOutcome, actions []RuleAction) {
	for _, act := range actions {
		switch strings.ToLower(act.Type) {
		case "move":
			if act.Target != "" {
				out.OverrideFolder = act.Target
			}
		case "archive":
			out.OverrideFolder = "archive"
		case "delete", "trash":
			out.OverrideFolder = "trash"
		case "mark_spam", "spam":
			out.OverrideFolder = "spam"
		case "mark_read", "read":
			out.MarkRead = true
		case "star":
			out.MarkStarred = true
		case "add_label", "label":
			if act.Target != "" {
				out.AddLabelIDs = append(out.AddLabelIDs, act.Target)
			}
		}
	}
}

func matchRuleTarget(r InboxRuleDTO, t ruleEvalTarget) bool {
	if r.AccountScope != "" && r.AccountScope != "all" && r.AccountScope != t.accountID {
		return false
	}
	if len(r.Conditions) == 0 {
		return false
	}
	isOr := strings.EqualFold(r.MatchMode, "OR")
	for _, c := range r.Conditions {
		matched := matchSingleCondition(c, t)
		if isOr && matched {
			return true
		}
		if !isOr && !matched {
			return false
		}
	}
	return !isOr
}

func matchSingleCondition(c RuleCondition, t ruleEvalTarget) bool {
	val := strings.ToLower(strings.TrimSpace(c.Value))
	var hay string
	switch strings.ToLower(c.Field) {
	case "sender", "from":
		hay = strings.ToLower(t.sender)
	case "subject":
		hay = strings.ToLower(t.subject)
	case "recipient", "to":
		hay = strings.ToLower(t.recipient)
	case "body":
		hay = strings.ToLower(t.body)
	case "has_attachment":
		return t.hasAtt
	case "attachment_ext":
		clean := strings.TrimPrefix(val, ".")
		for _, ext := range t.attExts {
			if strings.TrimPrefix(ext, ".") == clean {
				return true
			}
		}
		return false
	default:
		hay = strings.ToLower(t.sender + " " + t.subject)
	}
	switch strings.ToLower(c.Operator) {
	case "equals":
		return hay == val
	case "not_contains":
		return !strings.Contains(hay, val)
	case "starts_with":
		return strings.HasPrefix(hay, val)
	case "ends_with":
		return strings.HasSuffix(hay, val)
	case "regex":
		re, err := regexp.Compile(c.Value)
		return err == nil && re.MatchString(hay)
	default:
		return strings.Contains(hay, val)
	}
}
