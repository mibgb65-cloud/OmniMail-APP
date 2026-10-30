package domain

import (
	"context"
	"errors"
	"io"
)

var (
	ErrNetwork               = errors.New("NETWORK_FAILED")
	ErrAuthentication        = errors.New("AUTH_INVALID")
	ErrTLS                   = errors.New("TLS_REQUIRED")
	ErrTooLarge              = errors.New("MESSAGE_TOO_LARGE")
	ErrProtocol              = errors.New("MAIL_PROTOCOL_FAILED")
	ErrOAuthConfig           = errors.New("OAUTH_NOT_CONFIGURED")
	ErrCredentialMissing     = errors.New("CREDENTIAL_MISSING")
	ErrCredentialUnavailable = errors.New("CREDENTIAL_UNAVAILABLE")
	ErrCredentialInvalid     = errors.New("INVALID_CREDENTIAL")
	ErrCredentialCleanup     = errors.New("CREDENTIAL_CLEANUP_FAILED")
	ErrSendUncertain         = errors.New("SEND_UNCERTAIN")
)

type MailboxCursor struct {
	ID      string
	LastUID uint32
	ScanUID uint32
}

type MailRepository interface {
	AccountRepository
	PrepareMailbox(context.Context, string, RemoteMailbox, uint32) (MailboxCursor, error)
	SaveMailBatch(context.Context, string, string, uint32, uint32, uint32, []RemoteMessage, *uint32) error
	PageMail(context.Context, string, string, int) ([]MailSummary, error)
	MailLocation(context.Context, string) (MailLocation, uint32, error)
	ReadMail(context.Context, string) (MailDetail, error)
	SaveMailBody(context.Context, string, DecodedMail) error
	UpdateMailStarred(context.Context, string, bool) error
	ReadAttachment(context.Context, string) ([]byte, string, error)
	NextCachedUID(context.Context, string, uint32) (uint32, bool, error)
	CacheAttachment(context.Context, string, string, io.Reader) (DecodedAttachment, error)
	ReleaseCachedAttachments(context.Context, []string) error
}
type RemoteMailbox struct {
	Name string
	Kind string
}

type RemoteMessage struct {
	UID        uint32
	MessageID  string
	Subject    string
	From       string
	To         string
	ReceivedAt int64
	Read       bool
	Starred    bool
	Size       uint32
}

type MailSummary struct {
	ID         string `json:"id"`
	AccountID  string `json:"accountId"`
	Mailbox    string `json:"mailbox"`
	Subject    string `json:"subject"`
	From       string `json:"from"`
	To         string `json:"to"`
	ReceivedAt int64  `json:"receivedAt"`
	Read       bool   `json:"read"`
	Starred    bool   `json:"starred"`
	Cached     bool   `json:"cached"`
}

type AttachmentInfo struct {
	ID        string `json:"id"`
	Filename  string `json:"filename"`
	MIME      string `json:"mime"`
	Size      int64  `json:"size"`
	ContentID string `json:"contentId,omitempty"`
}

type MailDetail struct {
	MailSummary
	Body        string           `json:"body"`
	BodyHTML    string           `json:"bodyHtml,omitempty"`
	BodyVersion int              `json:"bodyVersion,omitempty"`
	RawHTML     string           `json:"-"`
	Attachments []AttachmentInfo `json:"attachments"`
}

type DecodedAttachment struct {
	Filename  string
	MIME      string
	Data      []byte
	Hash      string
	Size      int64
	ContentID string
}
type AttachmentSink func(string, string, io.Reader) (DecodedAttachment, error)

type DecodedMail struct {
	Text        string
	HTML        string
	Attachments []DecodedAttachment
}

type MailLocation struct {
	AccountID   string
	Mailbox     string
	UIDValidity uint32
	UID         uint32
}

type MailSession interface {
	Mailboxes() ([]RemoteMailbox, error)
	Select(string) (validity, next uint32, err error)
	LocateUID(from uint32) (uint32, bool, error)
	Headers(start, end uint32) ([]RemoteMessage, error)
	Body(uid uint32, sink AttachmentSink) (DecodedMail, error)
	Close() error
}

// MailFlagSession 是协议适配器的可选写能力；只读会话不能假装支持修改服务器标记。
type MailFlagSession interface {
	SetStarred(mailbox string, validity, uid uint32, starred bool) error
}

type MailTransport interface {
	Connect(context.Context, AccountEndpoint, []byte) (MailSession, error)
	CheckSMTP(context.Context, AccountEndpoint, []byte) error
	Send(context.Context, AccountEndpoint, []byte, string, []string, []byte) error
}
