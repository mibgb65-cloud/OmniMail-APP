package outbox

import "omnimail/internal/mailproto"

type DraftAttachmentDTO struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	SizeText  string `json:"sizeText"`
	SizeBytes int64  `json:"sizeBytes,omitempty"`
	FilePath  string `json:"filePath,omitempty"`
	MimeType  string `json:"mimeType,omitempty"`
	Status    string `json:"status"`
	Error     string `json:"error,omitempty"`
}

type ComposeDraftState struct {
	ID                string               `json:"id"`
	Mode              string               `json:"mode"`
	Minimized         bool                 `json:"minimized"`
	AccountID         string               `json:"accountId"`
	LockedAccount     bool                 `json:"lockedAccount"`
	UnlockIdentity    bool                 `json:"unlockIdentity,omitempty"`
	To                []string             `json:"to"`
	Cc                []string             `json:"cc"`
	Bcc               []string             `json:"bcc"`
	ShowCcBcc         bool                 `json:"showCcBcc"`
	Subject           string               `json:"subject"`
	Body              string               `json:"body"`
	BodyHTML          string               `json:"bodyHtml,omitempty"`
	Attachments       []DraftAttachmentDTO `json:"attachments"`
	SavedAt           string               `json:"savedAt"`
	ScheduledAt       string               `json:"scheduledAt,omitempty"`
	ScheduledAtUnixMs int64                `json:"scheduledAtUnixMs,omitempty"`
	ReplyToMailID     string               `json:"replyToMailId,omitempty"`
	InlineAiOpen      bool                 `json:"inlineAiOpen,omitempty"`
	UpdatedAtUnixMs   int64                `json:"updatedAtUnixMs,omitempty"`
}

type CreateDraftRequest struct {
	Mode          string   `json:"mode"`
	AccountID     string   `json:"accountId,omitempty"`
	ReplyToMailID string   `json:"replyToMailId,omitempty"`
	PrefillTo     []string `json:"prefillTo,omitempty"`
	Subject       string   `json:"subject,omitempty"`
	Body          string   `json:"body,omitempty"`
}

type SendDraftRequest struct {
	DraftID           string             `json:"draftId"`
	Draft             *ComposeDraftState `json:"draft,omitempty"`
	ScheduledAtUnixMs int64              `json:"scheduledAtUnixMs,omitempty"`
	UnlockIdentity    bool               `json:"unlockIdentity,omitempty"`
	BypassUndoWindow  bool               `json:"bypassUndoWindow,omitempty"`
}

type OutboxJobDTO struct {
	ID           string `json:"id"`
	AccountID    string `json:"accountId"`
	DraftID      string `json:"draftId"`
	MessageID    string `json:"messageId"`
	RFCMessageID string `json:"rfcMessageId"`
	Subject      string `json:"subject"`
	Recipients   string `json:"recipients"`
	State        string `json:"state"`
	NotBeforeAt  int64  `json:"notBeforeAt"`
	RetryCount   int    `json:"retryCount"`
	MaxRetries   int    `json:"maxRetries"`
	LastError    string `json:"lastError"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

type EnvelopeMeta struct {
	FromName           string                   `json:"fromName"`
	FromEmail          string                   `json:"fromEmail"`
	EnvelopeRecipients []string                 `json:"envelopeRecipients"`
	Subject            string                   `json:"subject"`
	Snippet            string                   `json:"snippet"`
	BodyText           string                   `json:"bodyText"`
	ToAddrs            []mailproto.EmailAddress `json:"toAddrs"`
	CcAddrs            []mailproto.EmailAddress `json:"ccAddrs"`
	BccAddrs           []mailproto.EmailAddress `json:"bccAddrs"`
	InReplyTo          string                   `json:"inReplyTo,omitempty"`
	References         []string                 `json:"references,omitempty"`
	HasAttachments     bool                     `json:"hasAttachments"`
}
