import type {
  ConnectRequest,
  EmailAccountDTO,
  UpdateRequest,
} from "../../bindings/omnimail/internal/accounts/models";
import type {
  ConnectionTestReport,
  ProviderPreset,
} from "../../bindings/omnimail/internal/mailproto/models";
import type { FlowStartResult } from "../../bindings/omnimail/internal/oauth/models";
import * as AccountService from "../../bindings/omnimail/services/accountservice";
import { INITIAL_ACCOUNTS } from "../data/accounts";
import { findProviderCatalogItem, PROVIDER_CATALOG } from "../data/providers";
import { getCurrentLanguage } from "../i18n";
import { isWailsDesktop } from "../state/storageHelpers";
import type {
  AuthMode,
  EmailAccount,
  ProviderCatalogItem,
  ProviderId,
  ServerEndpoint,
} from "../types/account";

export type {
  ConnectRequest,
  ConnectionTestReport,
  FlowStartResult,
  UpdateRequest,
};

export function mapAccountDTO(dto: EmailAccountDTO): EmailAccount {
  const sec = (s: string): ServerEndpoint["security"] =>
    s === "STARTTLS" || s === "NONE" ? s : "SSL/TLS";
  const winDays: 30 | 90 | 180 =
    dto.offlineWindowDays === 30 || dto.offlineWindowDays === 180
      ? dto.offlineWindowDays
      : 90;
  const st: EmailAccount["status"] =
    dto.status === "syncing" ||
    dto.status === "auth-expired" ||
    dto.status === "error"
      ? dto.status
      : "connected";
  return {
    id: dto.id,
    name: dto.name,
    shortTag: dto.shortTag,
    email: dto.email,
    provider: (dto.provider || "imap") as ProviderId,
    providerLabel: dto.providerLabel,
    authMode: (dto.authMode || "imap") as AuthMode,
    status: st,
    unreadCount: dto.unreadCount ?? 0,
    lastSyncedAt: dto.lastSyncedAt || "尚未同步",
    senderName: dto.senderName,
    replyTo: dto.replyTo,
    signature: dto.signature,
    imap: { ...dto.imap, security: sec(dto.imap.security) },
    smtp: { ...dto.smtp, security: sec(dto.smtp.security) },
    imapIdle: dto.imapIdle,
    offlineWindowDays: winDays,
    indexedEmails: dto.indexedEmails ?? 0,
    storageMb: dto.storageMb ?? 0,
    attachmentCacheMb: dto.attachmentCacheMb ?? 0,
    isDefault: dto.isDefault,
  };
}

function mapPresetToCatalog(p: ProviderPreset): ProviderCatalogItem {
  const base = findProviderCatalogItem(p.id as ProviderId);
  const tone =
    p.badgeTone === "blue" ||
    p.badgeTone === "amber" ||
    p.badgeTone === "violet"
      ? p.badgeTone
      : "neutral";
  return {
    ...base,
    id: p.id as ProviderId,
    name: p.name,
    subtitle: p.subtitle,
    badgeText: p.badgeText,
    badgeTone: tone,
    authMode: p.authMode as AuthMode,
    officialIcon: p.officialIcon,
    guideTitle: p.guideTitle,
    guideSummary: p.guideSummary,
    steps: p.steps ?? base.steps,
    defaultImapHost: p.defaultImapHost,
    defaultImapPort: p.defaultImapPort,
    defaultSmtpHost: p.defaultSmtpHost,
    defaultSmtpPort: p.defaultSmtpPort,
    note: p.note,
  };
}

export const accountApi = {
  async listProviderPresets(): Promise<ProviderCatalogItem[]> {
    if (!isWailsDesktop()) return PROVIDER_CATALOG;
    const list = await AccountService.ListProviderPresets();
    return (list ?? []).filter((p) => p.id !== "imap").map(mapPresetToCatalog);
  },

  async resolveProviderByEmail(email: string): Promise<ProviderPreset | null> {
    if (!isWailsDesktop()) return null;
    return AccountService.ResolveProviderByEmail(email);
  },

  async startOAuthFlow(provider: ProviderId): Promise<FlowStartResult> {
    if (!isWailsDesktop()) {
      return {
        flowId: `preview-${Date.now()}`,
        authUrl: "https://accounts.example.com/oauth",
        expiresAt: Date.now() + 300000,
      };
    }
    return AccountService.StartOAuthFlow(provider);
  },

  async cancelOAuthFlow(flowId: string): Promise<void> {
    if (!isWailsDesktop() || !flowId) return;
    await AccountService.CancelOAuthFlow(flowId);
  },

  async testConnection(req: ConnectRequest): Promise<ConnectionTestReport> {
    if (!isWailsDesktop()) {
      const en = getCurrentLanguage() === "en-US";
      const rows = en
        ? ([
            ["dns", "DNS & port check", 18, "Reachable"],
            ["tls", "TLS handshake", 42, "TLS 1.3 verified"],
            ["imap", "IMAP auth", 95, "6 folders found"],
            ["smtp", "SMTP auth", 76, "Ready"],
          ] as const)
        : ([
            ["dns", "DNS 与端口连通", 18, "端口可达"],
            ["tls", "TLS 安全握手", 42, "TLS 1.3 验证通过"],
            ["imap", "IMAP 认证", 95, "已识别 6 个文件夹"],
            ["smtp", "SMTP 认证", 76, "发件通道正常"],
          ] as const);
      return {
        ok: true,
        summary: en
          ? "Preview mode: 4-step handshake simulated"
          : "预览模式：四阶段连接模拟通过",
        discoveredMailboxes: 6,
        steps: rows.map(([stage, label, durationMs, detail]) => ({
          stage,
          label,
          ok: true,
          durationMs,
          detail,
        })),
      };
    }
    return AccountService.TestConnection(req);
  },

  async addAccount(req: ConnectRequest): Promise<EmailAccount> {
    if (!isWailsDesktop()) {
      return {
        ...INITIAL_ACCOUNTS[0],
        id: `acc-${Date.now()}`,
        name: req.name || req.email,
        shortTag: req.shortTag || req.provider,
        email: req.email,
        provider: req.provider as ProviderId,
      };
    }
    const dto = await AccountService.AddAccount(req);
    return mapAccountDTO(dto);
  },

  async listAccounts(): Promise<EmailAccount[]> {
    if (!isWailsDesktop()) return INITIAL_ACCOUNTS;
    const list = await AccountService.ListAccounts();
    return (list ?? []).map(mapAccountDTO);
  },

  async updateAccount(req: UpdateRequest): Promise<EmailAccount> {
    const dto = await AccountService.UpdateAccount(req);
    return mapAccountDTO(dto);
  },

  async setDefaultAccount(accountId: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await AccountService.SetDefaultAccount(accountId);
  },

  async removeAccount(accountId: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await AccountService.RemoveAccount(accountId);
  },

  async triggerSync(accountId = ""): Promise<void> {
    if (!isWailsDesktop()) return;
    await AccountService.TriggerSync(accountId);
  },
};
