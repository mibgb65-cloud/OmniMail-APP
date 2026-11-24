import { formatLocalizedTime, getCurrentLanguage, t } from "../i18n";
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
  const lang = getCurrentLanguage();
  const justNow = formatLocalizedTime("刚刚", lang);
  const senderName = account?.senderName ?? "OmniMail";
  const senderEmail = account?.email ?? "xinghe@studio.example";

  return {
    id: mailId,
    accountId: account?.id ?? "acc-gmail",
    accountTag: account?.shortTag ?? "Gmail",
    provider: account?.provider ?? "gmail",
    folder: targetFolder,
    senderName,
    senderEmail,
    avatarText: senderName.slice(0, 1).toUpperCase(),
    avatarTone: "slate",
    recipients: payload.to.join(", "),
    subject: payload.subject || t("common.noSubject"),
    snippet: payload.body.slice(0, 72) || "—",
    timeText: payload.scheduledAt ? payload.scheduledAt.slice(5) : justNow,
    fullTimeText: payload.scheduledAt ?? justNow,
    unread: false,
    starred: false,
    labels: [],
    scheduledAt: payload.scheduledAt,
    statusBadge: payload.scheduledAt
      ? t("compose.scheduledBadge", { time: payload.scheduledAt })
      : undefined,
    attachments: [],
    messages: [
      {
        id: `msg-${now}`,
        senderName,
        senderEmail,
        recipients: payload.to.join(", "),
        timeText: payload.scheduledAt ?? justNow,
        bodyParagraphs: payload.body.split("\n").filter(Boolean),
      },
    ],
  };
}
