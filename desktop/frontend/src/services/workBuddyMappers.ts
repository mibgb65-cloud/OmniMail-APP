import type {
  AccountDTO,
  Alias,
  DailyQuota,
  MessageDetailDTO,
  MessageListDTO,
  MessageSummaryDTO,
  StatusAndAliasesDTO,
} from "../../bindings/omnimail/internal/workbuddymail/models";
import {
  EMPTY_DAILY_QUOTA,
  type WorkBuddyAccount,
  type WorkBuddyAlias,
  type WorkBuddyAuthStage,
  type WorkBuddyDailyQuota,
  type WorkBuddyDirection,
  type WorkBuddyMailboxStatus,
  type WorkBuddyMessageDetail,
  type WorkBuddyMessageList,
  type WorkBuddyMessageSummary,
  type WorkBuddyStatusAndAliases,
} from "../types/workbuddy";

export function mapAuthStage(raw?: string): WorkBuddyAuthStage {
  if (
    raw === "polling" ||
    raw === "authorized" ||
    raw === "not_bound" ||
    raw === "cancelled" ||
    raw === "timeout" ||
    raw === "error"
  ) {
    return raw;
  }
  return "idle";
}

export function mapMailboxStatus(raw?: string): WorkBuddyMailboxStatus {
  if (
    raw === "running" ||
    raw === "not_bound" ||
    raw === "deactivated" ||
    raw === "suspended" ||
    raw === "banned" ||
    raw === "deleted" ||
    raw === "revoked" ||
    raw === "auth_failed"
  ) {
    return raw;
  }
  return "not_bound";
}

export function mapQuota(dto?: DailyQuota): WorkBuddyDailyQuota {
  if (!dto) return EMPTY_DAILY_QUOTA;
  return {
    limit: dto.limit ?? 0,
    remaining: dto.remaining ?? 0,
    reset: dto.reset ?? 0,
    hasQuota: Boolean(dto.hasQuota),
  };
}

export function mapAlias(dto: Alias): WorkBuddyAlias {
  return {
    aliasId: dto.aliasId ?? "",
    email: dto.email ?? "",
    isPrimary: Boolean(dto.isPrimary),
  };
}

export function mapAccount(dto: AccountDTO): WorkBuddyAccount {
  return {
    accountId: dto.accountId ?? "",
    workspaceId: dto.workspaceId ?? "",
    accountName: dto.accountName ?? "",
    email: dto.email ?? "",
    aliasId: dto.aliasId ?? "",
    aliases: (dto.aliases ?? []).map(mapAlias),
    mailboxStatus: mapMailboxStatus(dto.mailboxStatus),
    dailyQuota: mapQuota(dto.dailyQuota),
    lastRefreshedAt: dto.lastRefreshedAt ?? 0,
  };
}

export function mapStatusAndAliases(
  dto: StatusAndAliasesDTO,
): WorkBuddyStatusAndAliases {
  return {
    accounts: (dto.accounts ?? []).map(mapAccount),
    activeAccount: dto.activeAccount
      ? mapAccount(dto.activeAccount)
      : undefined,
    mailboxStatus: mapMailboxStatus(dto.mailboxStatus),
    aliases: (dto.aliases ?? []).map(mapAlias),
    primaryAliasId: dto.primaryAliasId ?? "",
    primaryEmail: dto.primaryEmail ?? "",
    dailyQuota: mapQuota(dto.dailyQuota),
  };
}

function mapSummary(dto: MessageSummaryDTO): WorkBuddyMessageSummary {
  const dir: WorkBuddyDirection = dto.direction === "sent" ? "sent" : "inbox";
  return {
    messageId: dto.messageId ?? "",
    subject: dto.subject ?? "",
    from: dto.from ?? "",
    to: dto.to ?? [],
    snippet: dto.snippet ?? "",
    createdAt: dto.createdAt ?? "",
    isRead: Boolean(dto.isRead),
    hasAttachments: Boolean(dto.hasAttachments),
    direction: dir,
  };
}

export function mapMessageList(dto: MessageListDTO): WorkBuddyMessageList {
  return {
    items: (dto.items ?? []).map(mapSummary),
    nextCursor: dto.nextCursor ?? "",
    hasMore: Boolean(dto.hasMore),
    dailyQuota: mapQuota(dto.dailyQuota),
  };
}

export function mapMessageDetail(
  dto: MessageDetailDTO,
): WorkBuddyMessageDetail {
  return {
    messageId: dto.messageId ?? "",
    subject: dto.subject ?? "",
    from: dto.from ?? "",
    to: dto.to ?? [],
    cc: dto.cc ?? [],
    createdAt: dto.createdAt ?? "",
    isRead: Boolean(dto.isRead),
    bodyFormat: dto.bodyFormat === "HTML" ? "HTML" : "TEXT",
    sanitizedHtml: dto.sanitizedHtml ?? "",
    plainText: dto.plainText ?? "",
    hasRemoteImages: Boolean(dto.hasRemoteImages),
    attachments: (dto.attachments ?? []).map((a) => ({
      attachmentId: a.attachmentId ?? "",
      filename: a.filename ?? "attachment",
      size: a.size ?? 0,
      contentType: a.contentType ?? "",
    })),
    dailyQuota: mapQuota(dto.dailyQuota),
  };
}
