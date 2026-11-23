package accounts

import (
	"fmt"
	"time"
)

type ServerEndpoint struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Security string `json:"security"`
}

type EmailAccountDTO struct {
	ID                string         `json:"id"`
	Name              string         `json:"name"`
	ShortTag          string         `json:"shortTag"`
	Email             string         `json:"email"`
	Username          string         `json:"username,omitempty"`
	Provider          string         `json:"provider"`
	ProviderLabel     string         `json:"providerLabel"`
	AuthMode          string         `json:"authMode"`
	Status            string         `json:"status"`
	LastError         string         `json:"lastError,omitempty"`
	UnreadCount       int            `json:"unreadCount"`
	LastSyncedAt      string         `json:"lastSyncedAt"`
	LastSyncedUnixMs  int64          `json:"lastSyncedUnixMs"`
	SenderName        string         `json:"senderName"`
	ReplyTo           string         `json:"replyTo"`
	Signature         string         `json:"signature"`
	Imap              ServerEndpoint `json:"imap"`
	Smtp              ServerEndpoint `json:"smtp"`
	CertFingerprint   string         `json:"certFingerprint,omitempty"`
	ImapIdle          bool           `json:"imapIdle"`
	OfflineWindowDays int            `json:"offlineWindowDays"`
	IndexedEmails     int            `json:"indexedEmails"`
	StorageMb         float64        `json:"storageMb"`
	AttachmentCacheMb float64        `json:"attachmentCacheMb"`
	IsDefault         bool           `json:"isDefault"`
	HasCredential     bool           `json:"hasCredential"`
}

type ConnectRequest struct {
	ID              string `json:"id,omitempty"`
	Name            string `json:"name"`
	ShortTag        string `json:"shortTag"`
	Email           string `json:"email"`
	Username        string `json:"username,omitempty"`
	Provider        string `json:"provider"`
	AuthMode        string `json:"authMode"`
	Secret          string `json:"secret"`
	SenderName      string `json:"senderName"`
	ImapHost        string `json:"imapHost"`
	ImapPort        int    `json:"imapPort"`
	ImapSecurity    string `json:"imapSecurity"`
	SmtpHost        string `json:"smtpHost"`
	SmtpPort        int    `json:"smtpPort"`
	SmtpSecurity    string `json:"smtpSecurity"`
	CertFingerprint string `json:"certFingerprint,omitempty"`
	SkipProbe       bool   `json:"skipProbe,omitempty"`
}

type UpdateRequest struct {
	ID                string          `json:"id"`
	Name              *string         `json:"name,omitempty"`
	ShortTag          *string         `json:"shortTag,omitempty"`
	SenderName        *string         `json:"senderName,omitempty"`
	ReplyTo           *string         `json:"replyTo,omitempty"`
	Signature         *string         `json:"signature,omitempty"`
	Imap              *ServerEndpoint `json:"imap,omitempty"`
	Smtp              *ServerEndpoint `json:"smtp,omitempty"`
	Secret            string          `json:"secret,omitempty"`
	CertFingerprint   *string         `json:"certFingerprint,omitempty"`
	ImapIdle          *bool           `json:"imapIdle,omitempty"`
	OfflineWindowDays *int            `json:"offlineWindowDays,omitempty"`
	IsDefault         *bool           `json:"isDefault,omitempty"`
}

func FormatRelativeSyncTime(unixMs int64) string {
	if unixMs <= 0 {
		return "尚未同步"
	}
	t := time.UnixMilli(unixMs)
	diff := time.Since(t)
	if diff < 60*time.Second {
		return "刚刚"
	}
	if diff < time.Hour {
		return fmt.Sprintf("%d 分钟前", int(diff.Minutes()))
	}
	now := time.Now()
	if t.Year() == now.Year() && t.YearDay() == now.YearDay() {
		return t.Format("15:04")
	}
	return t.Format("01-02 15:04")
}

func VaultImapPassKey(accountID string) string {
	return "account:" + accountID + ":imap_pass"
}

func VaultSmtpPassKey(accountID string) string {
	return "account:" + accountID + ":smtp_pass"
}
