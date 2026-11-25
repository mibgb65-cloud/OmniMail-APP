export const WORKBUDDY_OFFICIAL_GUIDE_URL = "https://www.workbuddy.cn";

export type WorkBuddyAuthStage =
  | "idle"
  | "polling"
  | "authorized"
  | "not_bound"
  | "cancelled"
  | "timeout"
  | "error";

export type WorkBuddyMailboxStatus =
  | "running"
  | "not_bound"
  | "deactivated"
  | "suspended"
  | "banned"
  | "deleted"
  | "revoked"
  | "auth_failed";

export type WorkBuddyDirection = "inbox" | "sent";

export interface WorkBuddyAlias {
  aliasId: string;
  email: string;
  isPrimary: boolean;
}

export interface WorkBuddyDailyQuota {
  limit: number;
  remaining: number;
  reset: number;
  hasQuota: boolean;
}

export interface WorkBuddyAuthStart {
  flowId: string;
  state: string;
  authUrl: string;
  baseUrl: string;
}

export interface WorkBuddyAuthPoll {
  flowId: string;
  stage: WorkBuddyAuthStage;
  mailboxStatus: WorkBuddyMailboxStatus;
  email: string;
  aliasId: string;
  aliases: WorkBuddyAlias[];
  uid: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface WorkBuddyAccount {
  accountId: string;
  workspaceId: string;
  accountName: string;
  email: string;
  aliasId: string;
  aliases: WorkBuddyAlias[];
  mailboxStatus: WorkBuddyMailboxStatus;
  dailyQuota: WorkBuddyDailyQuota;
  lastRefreshedAt: number;
}

export interface WorkBuddyStatusAndAliases {
  accounts: WorkBuddyAccount[];
  activeAccount?: WorkBuddyAccount;
  mailboxStatus: WorkBuddyMailboxStatus;
  aliases: WorkBuddyAlias[];
  primaryAliasId: string;
  primaryEmail: string;
  dailyQuota: WorkBuddyDailyQuota;
}

export interface WorkBuddyMessageSummary {
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  snippet: string;
  createdAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  direction: WorkBuddyDirection;
}

export interface WorkBuddyMessageList {
  items: WorkBuddyMessageSummary[];
  nextCursor: string;
  hasMore: boolean;
  dailyQuota: WorkBuddyDailyQuota;
}

export interface WorkBuddyAttachmentMeta {
  attachmentId: string;
  filename: string;
  size: number;
  contentType: string;
}

export interface WorkBuddyMessageDetail {
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  createdAt: string;
  isRead: boolean;
  bodyFormat: "HTML" | "TEXT";
  sanitizedHtml: string;
  plainText: string;
  hasRemoteImages: boolean;
  attachments: WorkBuddyAttachmentMeta[];
  dailyQuota: WorkBuddyDailyQuota;
}

export interface WorkBuddyDeleteResult {
  messageId: string;
  needsConfirmation: boolean;
  confirmationToken?: string;
  deleted: boolean;
  dailyQuota: WorkBuddyDailyQuota;
}

export interface WorkBuddyAttachmentSaveResult {
  saved: boolean;
  savedPath: string;
  filename: string;
  size: number;
}

export const EMPTY_DAILY_QUOTA: WorkBuddyDailyQuota = {
  limit: 0,
  remaining: 0,
  reset: 0,
  hasQuota: false,
};

export function deriveConnectModalState(input: {
  stage: WorkBuddyAuthStage;
  detectedEmail: string;
  busy: boolean;
}) {
  const isPolling = input.stage === "polling";
  const isAuthorized =
    input.stage === "authorized" && Boolean(input.detectedEmail.trim());
  const isNotBound = input.stage === "not_bound";
  const pillTone: "neutral" | "info" | "success" | "warning" = isAuthorized
    ? "success"
    : isPolling
      ? "info"
      : isNotBound
        ? "warning"
        : "neutral";
  return {
    isPolling,
    isAuthorized,
    isNotBound,
    pillTone,
    canSubmit: isAuthorized && !input.busy,
  };
}

export function shouldShowDailyQuota(quota?: WorkBuddyDailyQuota): boolean {
  return Boolean(quota && quota.hasQuota && quota.limit > 0);
}

export function markMessageReadInList(
  items: WorkBuddyMessageSummary[],
  messageId: string,
): WorkBuddyMessageSummary[] {
  return items.map((item) =>
    item.messageId === messageId ? { ...item, isRead: true } : item,
  );
}

export function removeDeletedMessageFromState(
  items: WorkBuddyMessageSummary[],
  selectedId: string,
  deletedId: string,
): { items: WorkBuddyMessageSummary[]; nextSelectedId: string } {
  const nextItems = items.filter((item) => item.messageId !== deletedId);
  const nextSelectedId =
    selectedId === deletedId ? (nextItems[0]?.messageId ?? "") : selectedId;
  return { items: nextItems, nextSelectedId };
}
