package contacts

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

type ContactItemDTO struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Email           string   `json:"email"`
	AlternateEmails []string `json:"alternateEmails,omitempty"`
	AvatarText      string   `json:"avatarText"`
	AvatarTone      string   `json:"avatarTone"`
	Company         string   `json:"company"`
	Title           string   `json:"title"`
	SourceAccountID string   `json:"sourceAccountId"`
	SourceTag       string   `json:"sourceTag"`
	Groups          []string `json:"groups"`
	VIP             bool     `json:"vip"`
	Blocked         bool     `json:"blocked"`
	MailCount       int      `json:"mailCount"`
	LastContactText string   `json:"lastContactText"`
	LastContactAt   int64    `json:"lastContactAt"`
	Phone           string   `json:"phone,omitempty"`
	Note            string   `json:"note,omitempty"`
}

type ContactQuery struct {
	Keyword string `json:"keyword,omitempty"`
	Group   string `json:"group,omitempty"`
	VIPOnly bool   `json:"vipOnly,omitempty"`
}

type DuplicateGroupDTO struct {
	Key        string           `json:"key"`
	Reason     string           `json:"reason"`
	Candidates []ContactItemDTO `json:"candidates"`
	HasRelay   bool             `json:"hasRelay"`
}

type ContactMergeGroup struct {
	GroupKey     string   `json:"groupKey"`
	PrimaryID    string   `json:"primaryId"`
	DuplicateIDs []string `json:"duplicateIds"`
}

type ContactMergeResult struct {
	Groups  int `json:"groups"`
	Removed int `json:"removed"`
}

type BlacklistEntryDTO struct {
	ID           string `json:"id"`
	Target       string `json:"target"`
	Kind         string `json:"kind"`
	Reason       string `json:"reason"`
	BlockedCount int    `json:"blockedCount"`
	AddedAt      string `json:"addedAt"`
}

type VCardImportResult struct {
	Imported int    `json:"imported"`
	Updated  int    `json:"updated"`
	Skipped  int    `json:"skipped"`
	FilePath string `json:"filePath,omitempty"`
}

var avatarTones = []string{"blue", "indigo", "emerald", "amber", "slate", "rose"}

func deriveAvatar(name, email string) (string, string) {
	src := strings.TrimSpace(name)
	if src == "" {
		src = strings.TrimSpace(email)
	}
	r, _ := utf8.DecodeRuneInString(src)
	txt := "U"
	if r != utf8.RuneError && r != 0 {
		txt = strings.ToUpper(string(r))
	}
	var h int
	for i := 0; i < len(email); i++ {
		h = h*31 + int(email[i])
	}
	if h < 0 {
		h = -h
	}
	return txt, avatarTones[h%len(avatarTones)]
}

func formatContactTime(ms int64) string {
	if ms <= 0 {
		return "暂无往来"
	}
	t := time.UnixMilli(ms)
	diff := time.Since(t)
	if diff < 24*time.Hour && t.YearDay() == time.Now().YearDay() {
		return "今天 " + t.Format("15:04")
	}
	if diff < 7*24*time.Hour {
		return fmt.Sprintf("%d 天前", int(diff.Hours()/24)+1)
	}
	return t.Format("2006-01-02")
}
