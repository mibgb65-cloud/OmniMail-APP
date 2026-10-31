import type { MailSummary } from '../lib/bridge/mail';

export interface MailViewOptions {
  unreadOnly: boolean;
  attachmentsOnly: boolean;
  oldestFirst: boolean;
}
export const DEFAULT_MAIL_VIEW: MailViewOptions = {
  unreadOnly: false,
  attachmentsOnly: false,
  oldestFirst: false,
};

export function selectMailView(messages: MailSummary[], query: string, options: MailViewOptions) {
  const needle = query.slice(0, 200).toLocaleLowerCase();
  return messages
    .filter(
      (message) =>
        (!options.unreadOnly || !message.read) &&
        (!options.attachmentsOnly || message.hasAttachments) &&
        `${message.subject} ${message.from}`.toLocaleLowerCase().includes(needle),
    )
    .sort((a, b) => {
      const order = a.receivedAt - b.receivedAt || a.id.localeCompare(b.id);
      return options.oldestFirst ? order : -order;
    });
}
