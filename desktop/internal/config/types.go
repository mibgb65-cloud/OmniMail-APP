package config

type ProfileMeta struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Badge           string `json:"badge"`
	Color           string `json:"color"`
	CustomDir       string `json:"customDir,omitempty"`
	ThemePreference string `json:"themePreference"`
	PinEnabled      bool   `json:"pinEnabled"`
	PinSalt         string `json:"pinSalt,omitempty"`
	PinHash         string `json:"pinHash,omitempty"`
	CreatedAt       string `json:"createdAt"`
	LastActiveAt    string `json:"lastActiveAt"`
}

type ProfileRegistry struct {
	Version  int           `json:"version"`
	Profiles []ProfileMeta `json:"profiles"`
}

type AutoReplyConfig struct {
	Enabled                   bool   `json:"enabled"`
	AccountID                 string `json:"accountId"`
	StartTime                 string `json:"startTime"`
	EndTime                   string `json:"endTime"`
	ContactsAndSameDomainOnly bool   `json:"contactsAndSameDomainOnly"`
	LimitOncePer4Days         bool   `json:"limitOncePer4Days"`
	Subject                   string `json:"subject"`
	Body                      string `json:"body"`
	RepliedCount              int    `json:"repliedCount"`
	EnabledAtUnixMs           int64  `json:"enabledAtUnixMs,omitempty"`
}

type AppSettings struct {
	Theme                         string          `json:"theme"`
	ThemePreference               string          `json:"themePreference"`
	Language                      string          `json:"language"`
	Density                       string          `json:"density"`
	FontSize                      string          `json:"fontSize"`
	LaunchAtStartup               bool            `json:"launchAtStartup"`
	SilentStartToTray             bool            `json:"silentStartToTray"`
	CloseToTray                   bool            `json:"closeToTray"`
	ShowDesktopNotifications      bool            `json:"showDesktopNotifications"`
	NotificationPermission        string          `json:"notificationPermission"`
	SyncIntervalMinutes           int             `json:"syncIntervalMinutes"`
	OfflineRetentionDays          int             `json:"offlineRetentionDays"`
	ImapIdle                      bool            `json:"imapIdle"`
	DefaultSendAccountID          string          `json:"defaultSendAccountId"`
	LockReplyToOriginalAccount    bool            `json:"lockReplyToOriginalAccount"`
	UndoSendSeconds               int             `json:"undoSendSeconds"`
	DefaultFontFamily             string          `json:"defaultFontFamily"`
	AutoAppendSignature           bool            `json:"autoAppendSignature"`
	AiEnabled                     bool            `json:"aiEnabled"`
	AiRequireConfirmEachTime      bool            `json:"aiRequireConfirmEachTime"`
	AiProvider                    string          `json:"aiProvider"`
	AiModel                       string          `json:"aiModel"`
	AiBaseURL                     string          `json:"aiBaseUrl"`
	AiApiKeyMasked                string          `json:"aiApiKeyMasked"`
	AiIncludeSenderAndAttachments bool            `json:"aiIncludeSenderAndAttachments"`
	BlockRemoteImages             bool            `json:"blockRemoteImages"`
	PhishingCheckEnabled          bool            `json:"phishingCheckEnabled"`
	LocalEncryptionEnabled        bool            `json:"localEncryptionEnabled"`
	AutoReply                     AutoReplyConfig `json:"autoReply"`
	AttachmentCacheLimitGb        float64         `json:"attachmentCacheLimitGb"`
	OAuthGoogleClientID           string          `json:"oauthGoogleClientId,omitempty"`
	OAuthOutlookClientID          string          `json:"oauthOutlookClientId,omitempty"`
}

type AppSettingsPatch struct {
	Theme                         *string          `json:"theme,omitempty"`
	ThemePreference               *string          `json:"themePreference,omitempty"`
	Language                      *string          `json:"language,omitempty"`
	Density                       *string          `json:"density,omitempty"`
	FontSize                      *string          `json:"fontSize,omitempty"`
	LaunchAtStartup               *bool            `json:"launchAtStartup,omitempty"`
	SilentStartToTray             *bool            `json:"silentStartToTray,omitempty"`
	CloseToTray                   *bool            `json:"closeToTray,omitempty"`
	ShowDesktopNotifications      *bool            `json:"showDesktopNotifications,omitempty"`
	NotificationPermission        *string          `json:"notificationPermission,omitempty"`
	SyncIntervalMinutes           *int             `json:"syncIntervalMinutes,omitempty"`
	OfflineRetentionDays          *int             `json:"offlineRetentionDays,omitempty"`
	ImapIdle                      *bool            `json:"imapIdle,omitempty"`
	DefaultSendAccountID          *string          `json:"defaultSendAccountId,omitempty"`
	LockReplyToOriginalAccount    *bool            `json:"lockReplyToOriginalAccount,omitempty"`
	UndoSendSeconds               *int             `json:"undoSendSeconds,omitempty"`
	DefaultFontFamily             *string          `json:"defaultFontFamily,omitempty"`
	AutoAppendSignature           *bool            `json:"autoAppendSignature,omitempty"`
	AiEnabled                     *bool            `json:"aiEnabled,omitempty"`
	AiRequireConfirmEachTime      *bool            `json:"aiRequireConfirmEachTime,omitempty"`
	AiProvider                    *string          `json:"aiProvider,omitempty"`
	AiModel                       *string          `json:"aiModel,omitempty"`
	AiBaseURL                     *string          `json:"aiBaseUrl,omitempty"`
	AiIncludeSenderAndAttachments *bool            `json:"aiIncludeSenderAndAttachments,omitempty"`
	BlockRemoteImages             *bool            `json:"blockRemoteImages,omitempty"`
	PhishingCheckEnabled          *bool            `json:"phishingCheckEnabled,omitempty"`
	LocalEncryptionEnabled        *bool            `json:"localEncryptionEnabled,omitempty"`
	AutoReply                     *AutoReplyConfig `json:"autoReply,omitempty"`
	AttachmentCacheLimitGb        *float64         `json:"attachmentCacheLimitGb,omitempty"`
	OAuthGoogleClientID           *string          `json:"oauthGoogleClientId,omitempty"`
	OAuthOutlookClientID          *string          `json:"oauthOutlookClientId,omitempty"`
}
