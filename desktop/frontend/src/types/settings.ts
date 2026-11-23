export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";
export type LanguageCode = "zh-CN" | "en-US";
export type DensityMode = "comfortable" | "compact";

export type SettingsTabId =
  | "general"
  | "accounts"
  | "account-detail"
  | "sync"
  | "compose"
  | "rules"
  | "auto-reply"
  | "ai"
  | "privacy"
  | "storage"
  | "shortcuts"
  | "about";

export interface AutoReplyConfig {
  enabled: boolean;
  accountId: string;
  startTime: string;
  endTime: string;
  contactsAndSameDomainOnly: boolean;
  limitOncePer4Days: boolean;
  subject: string;
  body: string;
  repliedCount: number;
}

export interface AppSettings {
  theme: ThemeMode;
  themePreference: ThemePreference;
  language: LanguageCode;
  density: DensityMode;
  fontSize: "small" | "standard" | "large";
  launchAtStartup: boolean;
  silentStartToTray?: boolean;
  closeToTray: boolean;
  showDesktopNotifications: boolean;
  notificationPermission: "granted" | "prompt" | "denied";
  syncIntervalMinutes: number;
  offlineRetentionDays: 30 | 90 | 180;
  imapIdle?: boolean;
  defaultSendAccountId: string;
  lockReplyToOriginalAccount: boolean;
  undoSendSeconds: 5 | 10 | 20;
  defaultFontFamily: string;
  autoAppendSignature: boolean;
  aiEnabled: boolean;
  aiRequireConfirmEachTime: boolean;
  aiProvider: string;
  aiModel: string;
  aiBaseUrl?: string;
  aiApiKeyMasked: string;
  aiIncludeSenderAndAttachments: boolean;
  blockRemoteImages: boolean;
  phishingCheckEnabled: boolean;
  localEncryptionEnabled: boolean;
  autoReply: AutoReplyConfig;
  attachmentCacheLimitGb: number;
  oauthGoogleClientId?: string;
  oauthOutlookClientId?: string;
}

export interface ComposeDraftState {
  id: string;
  mode: "new" | "reply" | "reply-all" | "forward";
  minimized: boolean;
  accountId: string;
  lockedAccount: boolean;
  unlockIdentity?: boolean;
  to: string[];
  cc: string[];
  bcc: string[];
  showCcBcc: boolean;
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments: Array<{
    id: string;
    name: string;
    sizeText: string;
    sizeBytes?: number;
    filePath?: string;
    mimeType?: string;
    status: "ready" | "uploading" | "failed";
    error?: string;
  }>;
  savedAt: string;
  scheduledAt?: string;
  scheduledAtUnixMs?: number;
  replyToMailId?: string;
  inlineAiOpen?: boolean;
}
