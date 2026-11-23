import type {
  ContactItemDTO,
  ContactQuery,
  DuplicateGroupDTO,
  VCardImportResult,
} from "../../bindings/omnimail/internal/contacts/models";
import * as ContactService from "../../bindings/omnimail/services/contactservice";
import { INITIAL_BLACKLIST, INITIAL_CONTACTS } from "../data/contacts";
import { isWailsDesktop } from "../state/storageHelpers";
import type { BlacklistEntry, ContactItem } from "../types/workspace";

export type { ContactQuery, DuplicateGroupDTO, VCardImportResult };

const VALID_TONES = new Set([
  "blue",
  "indigo",
  "emerald",
  "amber",
  "slate",
  "rose",
]);

function mapContactDTO(c: ContactItemDTO): ContactItem {
  const tone = VALID_TONES.has(c.avatarTone)
    ? (c.avatarTone as ContactItem["avatarTone"])
    : "blue";
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    avatarText: c.avatarText || "U",
    avatarTone: tone,
    company: c.company ?? "",
    title: c.title ?? "",
    sourceAccountId: c.sourceAccountId ?? "",
    sourceTag: c.sourceTag || "通讯录",
    groups: c.groups ?? [],
    vip: Boolean(c.vip),
    blocked: Boolean(c.blocked),
    mailCount: c.mailCount ?? 0,
    lastContactText: c.lastContactText || "暂无往来",
    phone: c.phone,
    note: c.note,
  };
}

export const contactApi = {
  async listContacts(
    query: Partial<ContactQuery> = {},
  ): Promise<ContactItem[]> {
    if (!isWailsDesktop()) return INITIAL_CONTACTS;
    const rows = await ContactService.ListContacts({
      keyword: query.keyword ?? "",
      group: query.group ?? "",
      vipOnly: Boolean(query.vipOnly),
    });
    return (rows ?? []).map(mapContactDTO);
  },

  async saveContact(item: ContactItem): Promise<ContactItem> {
    if (!isWailsDesktop()) return item;
    const saved = await ContactService.SaveContact({
      ...item,
      lastContactAt: Date.now(),
      phone: item.phone ?? "",
      note: item.note ?? "",
    });
    return mapContactDTO(saved);
  },

  async deleteContact(id: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await ContactService.DeleteContact(id);
  },

  async suggestRecipients(prefix: string): Promise<ContactItem[]> {
    if (!isWailsDesktop()) {
      const low = prefix.trim().toLowerCase();
      return INITIAL_CONTACTS.filter(
        (c) =>
          !low ||
          c.name.toLowerCase().includes(low) ||
          c.email.toLowerCase().includes(low),
      ).slice(0, 8);
    }
    const rows = await ContactService.SuggestRecipients(prefix);
    return (rows ?? []).map(mapContactDTO);
  },

  async findDuplicates(): Promise<DuplicateGroupDTO[]> {
    if (!isWailsDesktop()) return [];
    return (await ContactService.FindDuplicateContacts()) ?? [];
  },

  async mergeContacts(
    primaryId: string,
    dupIds: string[],
  ): Promise<ContactItem> {
    const merged = await ContactService.MergeContacts(primaryId, dupIds);
    return mapContactDTO(merged);
  },

  async importVCard(): Promise<VCardImportResult> {
    if (!isWailsDesktop()) {
      return { imported: 2, updated: 0, skipped: 0, filePath: "demo.vcf" };
    }
    return ContactService.ImportVCard();
  },

  async exportVCard(contactIds: string[] = []): Promise<string> {
    if (!isWailsDesktop()) return "contacts-export.vcf";
    return ContactService.ExportVCard(contactIds);
  },

  async listBlacklist(): Promise<BlacklistEntry[]> {
    if (!isWailsDesktop()) return INITIAL_BLACKLIST;
    const rows = await ContactService.ListBlacklist();
    return (rows ?? []).map((r) => ({
      id: r.id,
      target: r.target,
      kind: r.kind === "domain" ? "domain" : "address",
      reason: r.reason ?? "",
      blockedCount: r.blockedCount ?? 0,
      addedAt: r.addedAt || "刚刚",
    }));
  },

  async addBlacklist(
    target: string,
    kind: "domain" | "address",
    reason: string,
  ): Promise<BlacklistEntry> {
    if (!isWailsDesktop()) {
      return {
        id: `blk-${Date.now()}`,
        target,
        kind,
        reason,
        blockedCount: 0,
        addedAt: "今天",
      };
    }
    const r = await ContactService.AddBlacklist(target, kind, reason);
    return {
      id: r.id,
      target: r.target,
      kind: r.kind === "domain" ? "domain" : "address",
      reason: r.reason ?? "",
      blockedCount: r.blockedCount ?? 0,
      addedAt: r.addedAt || "今天",
    };
  },

  async removeBlacklist(id: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await ContactService.RemoveBlacklist(id);
  },
};
