import type {
  AttachmentDTO,
  MailItemDTO,
} from "../../bindings/omnimail/internal/search/models";
import type { ProviderId } from "../types/account";
import type {
  AttachmentItem,
  FolderId,
  MailItem,
  MeetingInvite,
} from "../types/mail";

export function mapAttachment(a: AttachmentDTO): AttachmentItem {
  const kind = (
    a.kind === "pdf" ||
    a.kind === "image" ||
    a.kind === "zip" ||
    a.kind === "ics"
      ? a.kind
      : "other"
  ) as AttachmentItem["kind"];
  const st = (
    ["remote", "ready", "downloading", "failed", "oversized"].includes(a.status)
      ? a.status
      : "ready"
  ) as AttachmentItem["status"];
  return {
    id: a.id,
    name: a.name,
    ext: a.ext,
    sizeText: a.sizeText,
    sizeBytes: a.sizeBytes,
    kind,
    status: st,
    progress: a.progress,
    previewSummary: a.previewSummary,
    previewUrl: a.previewUrl,
  };
}

export function mapMailDTO(dto: MailItemDTO): MailItem {
  const tone = (
    ["blue", "indigo", "emerald", "amber", "slate", "rose"].includes(
      dto.avatarTone,
    )
      ? dto.avatarTone
      : "blue"
  ) as MailItem["avatarTone"];
  return {
    id: dto.id,
    threadId: dto.threadId,
    accountId: dto.accountId,
    accountTag: dto.accountTag,
    provider: (dto.provider || "imap") as ProviderId,
    folder: (dto.folder || "inbox") as FolderId,
    senderName: dto.senderName,
    senderEmail: dto.senderEmail,
    avatarText: dto.avatarText || "M",
    avatarTone: tone,
    recipients: dto.recipients,
    cc: dto.cc,
    subject: dto.subject,
    snippet: dto.snippet,
    timeText: dto.timeText,
    fullTimeText: dto.fullTimeText,
    unread: dto.unread,
    starred: dto.starred,
    labels: dto.labels ?? [],
    statusBadge: dto.statusBadge,
    aiSummarized: dto.aiSummarized,
    snoozeUntil: dto.snoozeUntil,
    scheduledAt: dto.scheduledAt,
    outboxError: dto.outboxError,
    hasRemoteImages: dto.hasRemoteImages,
    remoteImagesAllowed: dto.remoteImagesAllowed,
    securityWarning: dto.securityWarning
      ? {
          level: dto.securityWarning.level === "danger" ? "danger" : "warning",
          title: dto.securityWarning.title,
          detail: dto.securityWarning.detail,
          spf: dto.securityWarning.spf,
          dkim: dto.securityWarning.dkim,
          dmarc: dto.securityWarning.dmarc,
        }
      : undefined,
    meetingInvite: dto.meetingInvite as unknown as MeetingInvite | undefined,
    attachments: (dto.attachments ?? []).map(mapAttachment),
    messages: (dto.messages ?? []).map((m) => ({
      id: m.id,
      senderName: m.senderName,
      senderEmail: m.senderEmail,
      recipients: m.recipients,
      cc: m.cc,
      timeText: m.timeText,
      bodyParagraphs: m.bodyParagraphs ?? [],
      bodyHtml: m.bodyHtml,
      collapsed: m.collapsed,
    })),
    rawHeaders: dto.rawHeaders,
  };
}
