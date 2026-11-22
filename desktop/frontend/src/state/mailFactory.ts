import type { EmailAccount } from "../types/account";
import type { MailItem } from "../types/mail";

export interface SendMailPayload {
  accountId: string;
  to: string[];
  subject: string;
  body: string;
  scheduledAt?: string;
}

export function createSentMailItem(
  account: EmailAccount | undefined,
  payload: SendMailPayload,
): MailItem {
  const now = Date.now();
  const mailId = `mail-sent-${now}`;
  const targetFolder = payload.scheduledAt ? "scheduled" : "sent";
  const senderName = account?.senderName ?? "陆星河";
  const senderEmail = account?.email ?? "xinghe@studio.example";

  return {
    id: mailId,
    accountId: account?.id ?? "acc-gmail",
    accountTag: account?.shortTag ?? "工作 · Gmail",
    provider: account?.provider ?? "gmail",
    folder: targetFolder,
    senderName,
    senderEmail,
    avatarText: "陆",
    avatarTone: "slate",
    recipients: payload.to.join(", "),
    subject: payload.subject || "（无主题）",
    snippet: payload.body.slice(0, 72) || "已发送邮件",
    timeText: payload.scheduledAt ? payload.scheduledAt.slice(5) : "刚刚",
    fullTimeText: payload.scheduledAt
      ? `计划发送：${payload.scheduledAt}`
      : "刚刚",
    unread: false,
    starred: false,
    labels: [],
    scheduledAt: payload.scheduledAt,
    statusBadge: payload.scheduledAt
      ? `定时 · ${payload.scheduledAt}`
      : undefined,
    attachments: [],
    messages: [
      {
        id: `msg-${now}`,
        senderName,
        senderEmail,
        recipients: payload.to.join(", "),
        timeText: payload.scheduledAt
          ? `计划发送 ${payload.scheduledAt}`
          : "刚刚",
        bodyParagraphs: payload.body.split("\n").filter(Boolean),
      },
    ],
  };
}
