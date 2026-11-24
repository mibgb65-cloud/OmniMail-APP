package config

import "time"

func DefaultAppSettings() AppSettings {
	return AppSettings{
		Theme:                         "light",
		ThemePreference:               "system",
		Language:                      "zh-CN",
		Density:                       "comfortable",
		FontSize:                      "standard",
		LaunchAtStartup:               false,
		SilentStartToTray:             false,
		CloseToTray:                   true,
		ShowDesktopNotifications:      true,
		NotificationPermission:        "granted",
		SyncIntervalMinutes:           5,
		OfflineRetentionDays:          90,
		ImapIdle:                      true,
		DefaultSendAccountID:          "",
		LockReplyToOriginalAccount:    true,
		UndoSendSeconds:               10,
		DefaultFontFamily:             "Inter / Noto Sans SC",
		AutoAppendSignature:           true,
		AiEnabled:                     false,
		TranslationEnabled:            true,
		TranslationProvider:           TranslationProviderFree,
		TranslationEndpoint:           DefaultTranslationEndpoint,
		TranslationTimeoutSec:         DefaultTranslationTimeoutSec,
		AiAutoSummarizeOnOpen:         false,
		AiRequireConfirmEachTime:      true,
		AiProvider:                    "openai",
		AiModel:                       "gpt-4.1-mini",
		AiBaseURL:                     "https://api.openai.com/v1",
		AiApiKeyMasked:                "",
		AiIncludeSenderAndAttachments: false,
		BlockRemoteImages:             true,
		PhishingCheckEnabled:          true,
		LocalEncryptionEnabled:        true,
		AutoReply: AutoReplyConfig{
			Enabled:                   false,
			AccountID:                 "all",
			StartTime:                 time.Now().Format("2006-01-02"),
			EndTime:                   time.Now().Add(72 * time.Hour).Format("2006-01-02"),
			ContactsAndSameDomainOnly: true,
			LimitOncePer4Days:         true,
			Subject:                   "自动回复：当前暂时离开，稍后统一回复",
			Body:                      "您好，我已收到您的邮件，将在返回工作台后第一时间处理并回复。",
			RepliedCount:              0,
		},
		AttachmentCacheLimitGb: 2.0,
	}
}

func ApplySettingsPatch(cur AppSettings, p AppSettingsPatch) AppSettings {
	out := cur
	if p.Theme != nil && (*p.Theme == "light" || *p.Theme == "dark") {
		out.Theme = *p.Theme
	}
	if p.ThemePreference != nil && (*p.ThemePreference == "light" || *p.ThemePreference == "dark" || *p.ThemePreference == "system") {
		out.ThemePreference = *p.ThemePreference
	}
	if p.Language != nil && (*p.Language == "zh-CN" || *p.Language == "en-US") {
		out.Language = *p.Language
	}
	if p.Density != nil && (*p.Density == "comfortable" || *p.Density == "compact") {
		out.Density = *p.Density
	}
	if p.FontSize != nil && (*p.FontSize == "small" || *p.FontSize == "standard" || *p.FontSize == "large") {
		out.FontSize = *p.FontSize
	}
	if p.LaunchAtStartup != nil {
		out.LaunchAtStartup = *p.LaunchAtStartup
	}
	if p.SilentStartToTray != nil {
		out.SilentStartToTray = *p.SilentStartToTray
	}
	if p.CloseToTray != nil {
		out.CloseToTray = *p.CloseToTray
	}
	if p.ShowDesktopNotifications != nil {
		out.ShowDesktopNotifications = *p.ShowDesktopNotifications
	}
	if p.NotificationPermission != nil {
		out.NotificationPermission = *p.NotificationPermission
	}
	if p.SyncIntervalMinutes != nil && *p.SyncIntervalMinutes >= 1 && *p.SyncIntervalMinutes <= 120 {
		out.SyncIntervalMinutes = *p.SyncIntervalMinutes
	}
	if p.OfflineRetentionDays != nil && (*p.OfflineRetentionDays == 30 || *p.OfflineRetentionDays == 90 || *p.OfflineRetentionDays == 180) {
		out.OfflineRetentionDays = *p.OfflineRetentionDays
	}
	if p.ImapIdle != nil {
		out.ImapIdle = *p.ImapIdle
	}
	if p.DefaultSendAccountID != nil {
		out.DefaultSendAccountID = *p.DefaultSendAccountID
	}
	if p.LockReplyToOriginalAccount != nil {
		out.LockReplyToOriginalAccount = *p.LockReplyToOriginalAccount
	}
	if p.UndoSendSeconds != nil && (*p.UndoSendSeconds == 5 || *p.UndoSendSeconds == 10 || *p.UndoSendSeconds == 20) {
		out.UndoSendSeconds = *p.UndoSendSeconds
	}
	if p.DefaultFontFamily != nil {
		out.DefaultFontFamily = *p.DefaultFontFamily
	}
	if p.AutoAppendSignature != nil {
		out.AutoAppendSignature = *p.AutoAppendSignature
	}
	if p.AiEnabled != nil {
		out.AiEnabled = *p.AiEnabled
	}
	if p.TranslationEnabled != nil {
		out.TranslationEnabled = *p.TranslationEnabled
	}
	if p.TranslationProvider != nil {
		out.TranslationProvider = *p.TranslationProvider
	}
	if p.TranslationEndpoint != nil {
		if endpoint, err := NormalizeTranslationEndpoint(*p.TranslationEndpoint); err == nil {
			out.TranslationEndpoint = endpoint
		}
	}
	if p.TranslationTimeoutSec != nil {
		out.TranslationTimeoutSec = *p.TranslationTimeoutSec
	}
	if p.AiAutoSummarizeOnOpen != nil {
		out.AiAutoSummarizeOnOpen = *p.AiAutoSummarizeOnOpen
	}
	if p.AiRequireConfirmEachTime != nil {
		out.AiRequireConfirmEachTime = *p.AiRequireConfirmEachTime
	}
	if p.AiProvider != nil {
		out.AiProvider = *p.AiProvider
	}
	if p.AiModel != nil {
		out.AiModel = *p.AiModel
	}
	if p.AiBaseURL != nil {
		out.AiBaseURL = *p.AiBaseURL
	}
	if p.AiIncludeSenderAndAttachments != nil {
		out.AiIncludeSenderAndAttachments = *p.AiIncludeSenderAndAttachments
	}
	if p.BlockRemoteImages != nil {
		out.BlockRemoteImages = *p.BlockRemoteImages
	}
	if p.PhishingCheckEnabled != nil {
		out.PhishingCheckEnabled = *p.PhishingCheckEnabled
	}
	if p.LocalEncryptionEnabled != nil {
		out.LocalEncryptionEnabled = *p.LocalEncryptionEnabled
	}
	if p.AutoReply != nil {
		nextAR := *p.AutoReply
		if nextAR.Enabled && !cur.AutoReply.Enabled {
			nextAR.EnabledAtUnixMs = time.Now().UnixMilli()
		} else {
			nextAR.EnabledAtUnixMs = cur.AutoReply.EnabledAtUnixMs
		}
		out.AutoReply = nextAR
	}
	if p.AttachmentCacheLimitGb != nil && *p.AttachmentCacheLimitGb >= 0.2 && *p.AttachmentCacheLimitGb <= 100 {
		out.AttachmentCacheLimitGb = *p.AttachmentCacheLimitGb
	}
	if p.OAuthGoogleClientID != nil {
		out.OAuthGoogleClientID = *p.OAuthGoogleClientID
	}
	if p.OAuthOutlookClientID != nil {
		out.OAuthOutlookClientID = *p.OAuthOutlookClientID
	}
	return out
}
