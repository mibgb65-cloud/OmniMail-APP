export type ProviderId =
  | "gmail"
  | "outlook"
  | "qq"
  | "netease"
  | "icloud"
  | "yahoo"
  | "yandex"
  | "linuxdo"
  | "nevermail"
  | "muse"
  | "workbuddy"
  | "imap";

export type ProviderCategory = "agent" | "standard";

export type AuthMode = "oauth" | "authcode" | "app-password" | "token" | "imap";

export interface ServerEndpoint {
  host: string;
  port: number;
  security: "SSL/TLS" | "STARTTLS" | "NONE";
}

export interface EmailAccount {
  id: string;
  name: string;
  shortTag: string;
  email: string;
  provider: ProviderId;
  providerLabel: string;
  authMode: AuthMode;
  status: "connected" | "syncing" | "auth-expired" | "error";
  lastError?: string;
  unreadCount: number;
  lastSyncedAt: string;
  senderName: string;
  replyTo: string;
  signature: string;
  imap: ServerEndpoint;
  smtp: ServerEndpoint;
  imapIdle: boolean;
  offlineWindowDays: 30 | 90 | 180;
  indexedEmails: number;
  storageMb: number;
  attachmentCacheMb: number;
  isDefault?: boolean;
}

export interface ProviderCatalogItem {
  id: ProviderId;
  category?: ProviderCategory;
  name: string;
  subtitle: string;
  domainHint: string;
  officialGuideUrl: string;
  emailPlaceholder?: string;
  badgeText: string;
  badgeTone: "blue" | "amber" | "violet" | "neutral";
  authMode: AuthMode;
  officialIcon: boolean;
  guideTitle: string;
  guideSummary: string;
  steps: string[];
  oauthSteps?: string[];
  defaultImapHost: string;
  defaultImapPort: number;
  defaultSmtpHost: string;
  defaultSmtpPort: number;
  note?: string;
}
