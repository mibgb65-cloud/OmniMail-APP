import type { ProviderId } from "./account";

export type FolderId =
  | "inbox"
  | "starred"
  | "snoozed"
  | "sent"
  | "drafts"
  | "archive"
  | "outbox"
  | "scheduled"
  | "spam"
  | "trash";

export type MailFilterTab = "all" | "unread" | "starred" | "attachments";

export interface MailLabel {
  id: string;
  name: string;
  color: string;
}

export interface AttachmentItem {
  id: string;
  name: string;
  ext: string;
  sizeText: string;
  sizeBytes: number;
  kind: "pdf" | "image" | "zip" | "ics" | "other";
  status: "remote" | "ready" | "downloading" | "failed" | "oversized";
  progress?: number;
  previewSummary?: string;
  previewUrl?: string;
}

export interface ThreadMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  recipients: string;
  cc?: string;
  timeText: string;
  bodyParagraphs: string[];
  bodyHtml?: string;
  collapsed?: boolean;
}

export interface MeetingInvite {
  title: string;
  monthLabel: string;
  dayNumber: string;
  dateTimeText: string;
  locationText: string;
  meetingLink: string;
  conflictStatus: "free" | "conflict";
  conflictHint?: string;
  icsFileName: string;
  attendees: Array<{
    name: string;
    role: string;
    status: "organizer" | "accepted" | "pending" | "declined";
  }>;
  rsvp: "pending" | "accepted" | "tentative" | "declined";
}

export interface MailItem {
  id: string;
  threadId?: string;
  accountId: string;
  accountTag: string;
  provider: ProviderId;
  folder: FolderId;
  senderName: string;
  senderEmail: string;
  avatarText: string;
  avatarTone: "blue" | "indigo" | "emerald" | "amber" | "slate" | "rose";
  recipients: string;
  cc?: string;
  subject: string;
  snippet: string;
  timeText: string;
  fullTimeText: string;
  receivedAtUnixMs?: number;
  unread: boolean;
  starred: boolean;
  labels: string[];
  statusBadge?: string;
  aiSummarized?: boolean;
  snoozeUntil?: string;
  scheduledAt?: string;
  outboxError?: string;
  hasRemoteImages?: boolean;
  remoteImagesAllowed?: boolean;
  securityWarning?: {
    level: "danger" | "warning";
    title: string;
    detail: string;
    spf: string;
    dkim: string;
    dmarc: string;
  };
  meetingInvite?: MeetingInvite;
  attachments: AttachmentItem[];
  messages: ThreadMessage[];
  rawHeaders?: string;
}
