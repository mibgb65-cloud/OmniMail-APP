package rules

import (
	"fmt"
	"strings"
)

type RuleCondition struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

type RuleAction struct {
	Type   string `json:"type"`
	Target string `json:"target"`
}

type InboxRuleDTO struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Enabled           bool            `json:"enabled"`
	Priority          int             `json:"priority"`
	MatchMode         string          `json:"matchMode"`
	AccountScope      string          `json:"accountScope"`
	ConditionSummary  string          `json:"conditionSummary"`
	ActionSummary     string          `json:"actionSummary"`
	ConditionField    string          `json:"conditionField"`
	ConditionOperator string          `json:"conditionOperator"`
	ConditionValue    string          `json:"conditionValue"`
	AttachmentExt     string          `json:"attachmentExt,omitempty"`
	ActionType        string          `json:"actionType"`
	ActionTarget      string          `json:"actionTarget"`
	Conditions        []RuleCondition `json:"conditions,omitempty"`
	Actions           []RuleAction    `json:"actions,omitempty"`
	StopMatching      bool            `json:"stopMatching"`
	HitsLast7Days     int             `json:"hitsLast7Days"`
}

type RulePreviewSample struct {
	ID          string `json:"id"`
	Subject     string `json:"subject"`
	SenderEmail string `json:"senderEmail"`
}

type RulePreviewResult struct {
	HitCount int                 `json:"hitCount"`
	Samples  []RulePreviewSample `json:"samples"`
}

func NormalizeRuleDTO(r *InboxRuleDTO) {
	if r.MatchMode != "OR" {
		r.MatchMode = "AND"
	}
	if strings.TrimSpace(r.AccountScope) == "" {
		r.AccountScope = "all"
	}
	if len(r.Conditions) == 0 && r.ConditionField != "" {
		r.Conditions = []RuleCondition{{
			Field:    r.ConditionField,
			Operator: defaultStr(r.ConditionOperator, "contains"),
			Value:    r.ConditionValue,
		}}
		if strings.TrimSpace(r.AttachmentExt) != "" {
			r.Conditions = append(r.Conditions, RuleCondition{
				Field:    "attachment_ext",
				Operator: "contains",
				Value:    r.AttachmentExt,
			})
		}
	}
	if len(r.Conditions) > 0 && r.ConditionField == "" {
		r.ConditionField = r.Conditions[0].Field
		r.ConditionOperator = r.Conditions[0].Operator
		r.ConditionValue = r.Conditions[0].Value
	}
	if len(r.Actions) == 0 && r.ActionType != "" {
		r.Actions = []RuleAction{{Type: r.ActionType, Target: r.ActionTarget}}
	}
	if len(r.Actions) > 0 && r.ActionType == "" {
		r.ActionType = r.Actions[0].Type
		r.ActionTarget = r.Actions[0].Target
	}
	if strings.TrimSpace(r.ConditionSummary) == "" {
		r.ConditionSummary = fmt.Sprintf("当 [%s] %s 「%s」", r.ConditionField, r.ConditionOperator, r.ConditionValue)
	}
	if strings.TrimSpace(r.ActionSummary) == "" {
		r.ActionSummary = fmt.Sprintf("执行 [%s] %s", r.ActionType, r.ActionTarget)
	}
}

func defaultStr(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}
