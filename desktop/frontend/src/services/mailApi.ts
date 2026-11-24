import type { MailSearchQuery } from "../../bindings/omnimail/internal/search/models";
import type { LoadOlderResult } from "../../bindings/omnimail/internal/syncer/models";
import * as MailService from "../../bindings/omnimail/services/mailservice";
import { INITIAL_LABELS } from "../data/accounts";
import { INITIAL_MAILS } from "../data/mails";
import { isWailsDesktop } from "../state/storageHelpers";
import type {
  AttachmentItem,
  FolderId,
  MailItem,
  MailLabel,
  MeetingInvite,
} from "../types/mail";
import { mapAttachment, mapMailDTO } from "./mailMapper";

export {
  mapAttachment,
  mapMailDTO,
  type LoadOlderResult,
  type MailSearchQuery,
};

export const mailApi = {
  async matchMailIds(query: MailSearchQuery, ids: string[]): Promise<string[]> {
    return isWailsDesktop()
      ? ((await MailService.MatchMailIDs(query, ids)) ?? [])
      : [];
  },

  async getFolderCounts(accountId = ""): Promise<Record<string, number>> {
    if (!isWailsDesktop()) {
      return {
        inbox: INITIAL_MAILS.filter((m) => m.unread && m.folder === "inbox")
          .length,
      };
    }
    const res = await MailService.GetFolderCounts(accountId);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(res.counts ?? {})) {
      if (typeof v === "number") out[k] = v;
    }
    return out;
  },

  async listMessages(query: MailSearchQuery): Promise<{
    items: MailItem[];
    nextCursor: string;
    totalCount: number;
    hasRemoteMore: boolean;
    remoteTotalCount: number;
  }> {
    if (!isWailsDesktop()) {
      return {
        items: INITIAL_MAILS,
        nextCursor: "",
        totalCount: INITIAL_MAILS.length,
        hasRemoteMore: false,
        remoteTotalCount: INITIAL_MAILS.length,
      };
    }
    const page = await MailService.ListMessages(query);
    return {
      items: (page.items ?? []).map(mapMailDTO),
      nextCursor: page.nextCursor ?? "",
      totalCount: page.totalCount ?? 0,
      hasRemoteMore: Boolean(page.hasRemoteMore),
      remoteTotalCount: page.remoteTotalCount ?? 0,
    };
  },

  async loadOlderMessages(
    accountId: string,
    folder: FolderId,
    limit = 50,
  ): Promise<LoadOlderResult> {
    if (!isWailsDesktop()) {
      return {
        fetchedCount: 0,
        hasRemoteMore: false,
        remoteTotal: 0,
        localSynced: INITIAL_MAILS.length,
      };
    }
    const res = await MailService.LoadOlderMessages(accountId, folder, limit);
    return {
      fetchedCount: res.fetchedCount ?? 0,
      hasRemoteMore: Boolean(res.hasRemoteMore),
      remoteTotal: res.remoteTotal ?? 0,
      localSynced: res.localSynced ?? 0,
    };
  },

  async getThreadDetail(idOrThreadId: string): Promise<MailItem | null> {
    if (!isWailsDesktop()) {
      return INITIAL_MAILS.find((m) => m.id === idOrThreadId) ?? null;
    }
    const dto = await MailService.GetThreadDetail(idOrThreadId);
    return mapMailDTO(dto);
  },

  async allowRemoteImages(mailId: string): Promise<string> {
    if (!isWailsDesktop()) return "";
    return MailService.AllowRemoteImages(mailId);
  },

  async markRead(mailIds: string[], isRead: boolean): Promise<void> {
    if (isWailsDesktop()) await MailService.MarkRead(mailIds, isRead);
  },

  async toggleStar(mailIds: string[], isStarred: boolean): Promise<void> {
    if (isWailsDesktop()) await MailService.ToggleStar(mailIds, isStarred);
  },

  async moveToFolder(mailIds: string[], targetFolder: FolderId): Promise<void> {
    if (isWailsDesktop()) await MailService.MoveToFolder(mailIds, targetFolder);
  },

  async snoozeMessages(mailIds: string[], wakeUpUnixMs: number): Promise<void> {
    if (isWailsDesktop()) {
      await MailService.SnoozeMessages(mailIds, wakeUpUnixMs);
    }
  },

  async deletePermanently(mailIds: string[]): Promise<void> {
    if (isWailsDesktop()) await MailService.DeletePermanently(mailIds);
  },

  async emptyTrash(): Promise<void> {
    if (isWailsDesktop()) await MailService.EmptyTrash();
  },

  async listLabels(): Promise<MailLabel[]> {
    if (!isWailsDesktop()) return INITIAL_LABELS;
    return (await MailService.ListLabels()) ?? [];
  },

  async saveLabel(label: MailLabel): Promise<MailLabel> {
    if (!isWailsDesktop()) return label;
    return MailService.SaveLabel(label);
  },

  async deleteLabel(id: string): Promise<void> {
    if (isWailsDesktop()) await MailService.DeleteLabel(id);
  },

  async applyLabels(
    mailIds: string[],
    addIds: string[],
    removeIds: string[],
  ): Promise<void> {
    if (isWailsDesktop()) {
      await MailService.ApplyLabels(mailIds, addIds, removeIds);
    }
  },

  async downloadAttachment(attId: string): Promise<AttachmentItem> {
    const dto = await MailService.DownloadAttachment(attId);
    return mapAttachment(dto);
  },

  async openAttachment(attId: string): Promise<void> {
    if (isWailsDesktop()) await MailService.OpenAttachment(attId);
  },

  async saveAttachmentAs(attId: string): Promise<string> {
    if (!isWailsDesktop()) return "Downloads/attachment";
    return MailService.SaveAttachmentAs(attId);
  },

  async saveImageDataAs(
    filename: string,
    dataOrBase64: string,
  ): Promise<string> {
    if (!isWailsDesktop()) return "";
    return MailService.SaveImageDataAs(filename, dataOrBase64);
  },

  async respondMeetingInvite(
    mailId: string,
    rsvp: string,
  ): Promise<MeetingInvite> {
    const dto = await MailService.RespondMeetingInvite(mailId, rsvp);
    return dto as unknown as MeetingInvite;
  },

  async exportMeetingICS(mailId: string): Promise<string> {
    if (!isWailsDesktop()) return "invite.ics";
    return MailService.ExportMeetingICS(mailId);
  },

  async exportMessageEML(mailId: string): Promise<string> {
    if (!isWailsDesktop()) return "mail.eml";
    return MailService.ExportMessageEML(mailId);
  },

  async exportFolderMBOX(folder: FolderId): Promise<string> {
    if (!isWailsDesktop()) return `${folder}.mbox`;
    return MailService.ExportFolderMBOX(folder);
  },
};
