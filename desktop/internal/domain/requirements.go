package domain

import (
	"context"
	"strings"
	"time"
)

const RequirementFormat = "requirements-v1"

type TaskPreferencesInput struct {
	Enabled  bool     `json:"enabled"`
	Consent  bool     `json:"consent"`
	Accounts []string `json:"accounts"`
	Folders  []string `json:"folders"`
	Time     string   `json:"time"`
	Timezone string   `json:"timezone"`
	Limit    int      `json:"limit"`
}

type TaskPreferences struct {
	TaskPreferencesInput
	Revision   string `json:"revision"`
	AIRevision string `json:"aiRevision"`
}

func (p TaskPreferencesInput) Validate() error {
	if p.Limit < 1 || p.Limit > 100 || len(p.Accounts) > 20 || len(p.Folders) < 1 || len(p.Folders) > 4 ||
		(p.Enabled && !p.Consent) || (p.Consent && len(p.Accounts) == 0) ||
		len(p.Time) != 5 || len(p.Timezone) > 64 || p.Timezone == "" || p.Timezone == "Local" {
		return ErrTaskInput
	}
	if _, err := time.Parse("15:04", p.Time); err != nil {
		return ErrTaskInput
	}
	if _, err := time.LoadLocation(p.Timezone); err != nil {
		return ErrTaskInput
	}
	seen := map[string]bool{}
	for _, id := range p.Accounts {
		if !ValidAccountID(id) || seen[id] {
			return ErrTaskInput
		}
		seen[id] = true
	}
	seen = map[string]bool{}
	for _, folder := range p.Folders {
		if (folder != "inbox" && folder != "archive" && folder != "sent" && folder != "other") || seen[folder] {
			return ErrTaskInput
		}
		seen[folder] = true
	}
	return nil
}

func (p TaskPreferences) Allows(account, folder string) bool {
	accountOK, folderOK := false, false
	for _, id := range p.Accounts {
		accountOK = accountOK || id == account
	}
	for _, kind := range p.Folders {
		folderOK = folderOK || kind == folder
	}
	return accountOK && folderOK
}

type RequirementCandidate struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Evidence string `json:"evidence"`
}
type RequirementInput struct {
	Source     TranslatedText         `json:"mail"`
	Candidates []RequirementCandidate `json:"candidates"`
}
type Requirement struct {
	Title     string `json:"title"`
	Evidence  string `json:"evidence"`
	Owner     string `json:"owner"`
	Due       string `json:"due"`
	RelatedID string `json:"relatedId"`
	Kind      string `json:"kind"`
	Reason    string `json:"reason"`
}
type RequirementOutput struct {
	Items []Requirement `json:"items"`
}

func (o RequirementOutput) Validate(input RequirementInput) error {
	if o.Items == nil || len(o.Items) > 12 {
		return ErrAIResponse
	}
	candidates := map[string]bool{}
	for _, c := range input.Candidates {
		candidates[c.ID] = true
	}
	seen := map[string]bool{}
	source := input.Source.Subject + "\n" + input.Source.Body
	for _, r := range o.Items {
		key := r.Title + "\x00" + r.Evidence + "\x00" + r.RelatedID + "\x00" + r.Kind
		if seen[key] || !TaskText(r.Title, 1000, true) || !TaskText(r.Evidence, 2000, true) ||
			!strings.Contains(source, r.Evidence) || !TaskText(r.Owner, 200, false) ||
			!TaskText(r.Due, 100, false) || !TaskText(r.Reason, 1000, false) ||
			(r.Owner != "" && !strings.Contains(r.Evidence, r.Owner)) ||
			(r.Due != "" && !strings.Contains(r.Evidence, r.Due)) {
			return ErrAIResponse
		}
		if r.Kind == "new" {
			if r.RelatedID != "" {
				return ErrAIResponse
			}
		} else if !candidates[r.RelatedID] || (r.Kind != "update" && r.Kind != "conflict" && r.Kind != "cancel" && r.Kind != "complete") {
			return ErrAIResponse
		}
		seen[key] = true
	}
	return nil
}

type RequirementProvider interface {
	Extract(context.Context, AIConfig, []byte, RequirementInput) (RequirementOutput, error)
}

type TaskMail struct {
	MailDetail
	MessageID    string
	Folder       string
	BodyRevision int
}

type TaskRun struct {
	ID            string `json:"id"`
	Kind          string `json:"kind"`
	State         string `json:"state"`
	Slot          string `json:"slot"`
	PrefsRevision string `json:"prefsRevision"`
	StartedAt     int64  `json:"startedAt"`
	FinishedAt    int64  `json:"finishedAt"`
	Total         int    `json:"total"`
	Done          int    `json:"done"`
	Failed        int    `json:"failed"`
	Unknown       int    `json:"unknown"`
	Pending       int    `json:"pending"`
	WaitingBody   int    `json:"waitingBody"`
	Remaining     int    `json:"remaining"`
	Error         string `json:"error"`
	RetryUnknown  bool   `json:"retryUnknown"`
	NewTodos      int    `json:"newTodos"`
	Changes       int    `json:"changes"`
	SyncPending   bool   `json:"syncPending"`
}
type TaskRunMail struct {
	MailID  string `json:"mailId"`
	Subject string `json:"subject"`
	State   string `json:"state"`
	Error   string `json:"error"`
}
type TaskRunDetails struct {
	Run   TaskRun       `json:"run"`
	Mails []TaskRunMail `json:"mails"`
}
type TaskBatchInput struct {
	MailIDs      []string `json:"mailIds"`
	RetryUnknown bool     `json:"retryUnknown"`
}
