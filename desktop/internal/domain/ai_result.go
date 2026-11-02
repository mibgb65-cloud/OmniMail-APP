package domain

import (
	"context"
	"strings"
	"unicode/utf8"
)

type AIRequest struct {
	MailID     string `json:"mailId"`
	Action     string `json:"action"`
	Intent     string `json:"intent"`
	Tone       string `json:"tone"`
	Regenerate bool   `json:"regenerate"`
}

func (r AIRequest) Validate() error {
	if !ValidAccountID(r.MailID) || !utf8.ValidString(r.Intent) || len(r.Intent) > 2000 {
		return ErrAIInput
	}
	if r.Action == "analysis" && r.Intent == "" && r.Tone == "" {
		return nil
	}
	if r.Action == "reply" && strings.TrimSpace(r.Intent) != "" &&
		(r.Tone == "neutral" || r.Tone == "friendly" || r.Tone == "formal") {
		return nil
	}
	return ErrAIInput
}

type AITask struct {
	Text     string `json:"text"`
	Evidence string `json:"evidence"`
	Owner    string `json:"owner"`
	Due      string `json:"due"`
}

type AIFact struct {
	Text     string `json:"text"`
	Evidence string `json:"evidence"`
}

type AIOutput struct {
	Summary string   `json:"summary"`
	Points  []string `json:"points"`
	Tasks   []AITask `json:"tasks"`
	Facts   []AIFact `json:"facts"`
	Reply   string   `json:"reply"`
}

type AIResult struct {
	AIOutput
	MailID     string `json:"mailId"`
	AccountID  string `json:"accountId"`
	SourceHash string `json:"sourceHash"`
	Revision   string `json:"revision"`
	Action     string `json:"action"`
	Language   string `json:"language"`
	Model      string `json:"model"`
	Cached     bool   `json:"cached"`
	Warning    string `json:"warning"`
}

type AIProvider interface {
	Generate(context.Context, AIConfig, []byte, TranslatedText, AIRequest) (AIOutput, error)
}

type AIStore interface {
	AIConfigStore
	ReadAICache(context.Context, string) (AIResult, bool, error)
	WriteAICache(context.Context, string, AIResult) error
	ClearAICache(context.Context) error
}

type AIRateLimit struct{ Seconds int }

func (e *AIRateLimit) Error() string        { return ErrAIRate.Error() }
func (e *AIRateLimit) Is(target error) bool { return target == ErrAIRate }

func aiText(value string, maximum int, required bool) bool {
	return utf8.ValidString(value) && len(value) <= maximum && (!required || strings.TrimSpace(value) != "")
}

// 引文必须来自当前原文，负责人和日期保留原文形式；无法校验模型语义，不宣称自动识别绝对正确。
func (o AIOutput) Validate(source TranslatedText, action string) error {
	if !aiText(o.Summary, 4000, action == "analysis") || !aiText(o.Reply, 16<<10, action == "reply") ||
		o.Points == nil || o.Tasks == nil || o.Facts == nil || len(o.Points) > 12 || len(o.Tasks) > 12 || len(o.Facts) > 12 {
		return ErrAIResponse
	}
	if action == "analysis" && o.Reply != "" || action == "reply" &&
		(o.Summary != "" || len(o.Points)+len(o.Tasks)+len(o.Facts) != 0) {
		return ErrAIResponse
	}
	text := source.Subject + "\n" + source.Body
	evidence := func(value string) bool { return aiText(value, 2000, true) && strings.Contains(text, value) }
	for _, point := range o.Points {
		if !aiText(point, 1000, true) {
			return ErrAIResponse
		}
	}
	for _, task := range o.Tasks {
		if !aiText(task.Text, 1000, true) || !evidence(task.Evidence) ||
			!aiText(task.Owner, 200, false) || !aiText(task.Due, 100, false) ||
			(task.Owner != "" && !strings.Contains(task.Evidence, task.Owner)) ||
			(task.Due != "" && !strings.Contains(task.Evidence, task.Due)) {
			return ErrAIResponse
		}
	}
	for _, fact := range o.Facts {
		if !aiText(fact.Text, 1000, true) || !evidence(fact.Evidence) {
			return ErrAIResponse
		}
	}
	return nil
}
