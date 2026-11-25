package workbuddymail

import "net/http"

const (
	DefaultBaseURL  = "https://www.workbuddy.cn"
	FallbackBaseURL = "https://copilot.tencent.com"
	AuthPrefixPath  = "/plugin"
	AuthPlatform    = "workbuddy"

	MaxJSONResponseBytes       = 8 << 20
	MaxAttachmentResponseBytes = 36 << 20
	MaxAttachmentDecodedBytes  = 25 << 20
	DefaultPageSize            = 50
)

type MailboxServiceStatus string

const (
	StatusRunning     MailboxServiceStatus = "running"
	StatusNotBound    MailboxServiceStatus = "not_bound"
	StatusDeactivated MailboxServiceStatus = "deactivated"
	StatusSuspended   MailboxServiceStatus = "suspended"
	StatusBanned      MailboxServiceStatus = "banned"
	StatusDeleted     MailboxServiceStatus = "deleted"
	StatusRevoked     MailboxServiceStatus = "revoked"
	StatusAuthFailed  MailboxServiceStatus = "auth_failed"
)

type AuthFlowStage string

const (
	AuthStageIdle       AuthFlowStage = "idle"
	AuthStagePolling    AuthFlowStage = "polling"
	AuthStageAuthorized AuthFlowStage = "authorized"
	AuthStageNotBound   AuthFlowStage = "not_bound"
	AuthStageCancelled  AuthFlowStage = "cancelled"
	AuthStageTimeout    AuthFlowStage = "timeout"
	AuthStageError      AuthFlowStage = "error"
)

// TokenCredentials 仅驻留内存与加密 Vault，绝不通过 JSON DTO 暴露给前端。
type TokenCredentials struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	UID          string `json:"uid"`
	EnterpriseID string `json:"enterpriseId,omitempty"`
	TenantID     string `json:"tenantId,omitempty"`
	Domain       string `json:"domain,omitempty"`
	BaseURL      string `json:"baseUrl,omitempty"`
	ExpiresAt    int64  `json:"expiresAt,omitempty"`
}

type TransportConfig struct {
	HTTPClient        *http.Client
	AllowLoopbackHTTP bool
}

type Alias struct {
	AliasID   string `json:"aliasId"`
	Email     string `json:"email"`
	IsPrimary bool   `json:"isPrimary"`
}

type DailyQuota struct {
	Limit     int  `json:"limit"`
	Remaining int  `json:"remaining"`
	Reset     int  `json:"reset"`
	HasQuota  bool `json:"hasQuota"`
}

type ConnectorState struct {
	Status   MailboxServiceStatus `json:"status"`
	Alias    string               `json:"alias"`
	OpenedAt int64                `json:"openedAt,omitempty"`
	UserType string               `json:"userType,omitempty"`
}

type AuthStartResult struct {
	FlowID  string `json:"flowId"`
	State   string `json:"state"`
	AuthURL string `json:"authUrl"`
	BaseURL string `json:"baseUrl"`
}

type AuthPollResult struct {
	FlowID        string               `json:"flowId"`
	Stage         AuthFlowStage        `json:"stage"`
	MailboxStatus MailboxServiceStatus `json:"mailboxStatus"`
	Email         string               `json:"email"`
	AliasID       string               `json:"aliasId"`
	Aliases       []Alias              `json:"aliases"`
	UID           string               `json:"uid"`
	ErrorCode     string               `json:"errorCode,omitempty"`
	ErrorMessage  string               `json:"errorMessage,omitempty"`
}

type AccountDTO struct {
	AccountID       string               `json:"accountId"`
	WorkspaceID     string               `json:"workspaceId"`
	AccountName     string               `json:"accountName"`
	Email           string               `json:"email"`
	AliasID         string               `json:"aliasId"`
	Aliases         []Alias              `json:"aliases"`
	MailboxStatus   MailboxServiceStatus `json:"mailboxStatus"`
	DailyQuota      DailyQuota           `json:"dailyQuota"`
	LastRefreshedAt int64                `json:"lastRefreshedAt"`
}

type StatusAndAliasesDTO struct {
	Accounts       []AccountDTO         `json:"accounts"`
	ActiveAccount  *AccountDTO          `json:"activeAccount,omitempty"`
	MailboxStatus  MailboxServiceStatus `json:"mailboxStatus"`
	Aliases        []Alias              `json:"aliases"`
	PrimaryAliasID string               `json:"primaryAliasId"`
	PrimaryEmail   string               `json:"primaryEmail"`
	DailyQuota     DailyQuota           `json:"dailyQuota"`
}

type MessageSummaryDTO struct {
	MessageID      string   `json:"messageId"`
	Subject        string   `json:"subject"`
	From           string   `json:"from"`
	To             []string `json:"to"`
	Snippet        string   `json:"snippet"`
	CreatedAt      string   `json:"createdAt"`
	IsRead         bool     `json:"isRead"`
	HasAttachments bool     `json:"hasAttachments"`
	Direction      string   `json:"direction"`
}

type MessageListDTO struct {
	Items      []MessageSummaryDTO `json:"items"`
	NextCursor string              `json:"nextCursor"`
	HasMore    bool                `json:"hasMore"`
	DailyQuota DailyQuota          `json:"dailyQuota"`
}

type AttachmentMetaDTO struct {
	AttachmentID string `json:"attachmentId"`
	Filename     string `json:"filename"`
	Size         int64  `json:"size"`
	ContentType  string `json:"contentType"`
}

type MessageDetailDTO struct {
	MessageID       string              `json:"messageId"`
	Subject         string              `json:"subject"`
	From            string              `json:"from"`
	To              []string            `json:"to"`
	Cc              []string            `json:"cc"`
	CreatedAt       string              `json:"createdAt"`
	IsRead          bool                `json:"isRead"`
	BodyFormat      string              `json:"bodyFormat"`
	SanitizedHTML   string              `json:"sanitizedHtml"`
	PlainText       string              `json:"plainText"`
	HasRemoteImages bool                `json:"hasRemoteImages"`
	Attachments     []AttachmentMetaDTO `json:"attachments"`
	DailyQuota      DailyQuota          `json:"dailyQuota"`
}

type DeleteResultDTO struct {
	MessageID         string     `json:"messageId"`
	NeedsConfirmation bool       `json:"needsConfirmation"`
	ConfirmationToken string     `json:"confirmationToken,omitempty"`
	Deleted           bool       `json:"deleted"`
	DailyQuota        DailyQuota `json:"dailyQuota"`
}

type DecodedAttachment struct {
	Filename    string
	ContentType string
	Data        []byte
	DailyQuota  DailyQuota
}

type AttachmentSaveResultDTO struct {
	Saved     bool   `json:"saved"`
	SavedPath string `json:"savedPath"`
	Filename  string `json:"filename"`
	Size      int64  `json:"size"`
}
