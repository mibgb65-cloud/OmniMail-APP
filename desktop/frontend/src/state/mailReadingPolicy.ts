import type { MailFilterTab, MailItem } from "../types/mail";

// 自动预览只决定右侧显示哪一封；未读状态由显式打开动作更新。
export function previewMail<T extends { id: string }>(
  mails: readonly T[],
  filtered: readonly T[],
  selectedId: string,
): T | null {
  return mails.find((mail) => mail.id === selectedId) ?? filtered[0] ?? null;
}

export function openedUnreadId(
  mails: readonly Pick<MailItem, "id" | "unread">[],
  id: string,
) {
  return mails.find((mail) => mail.id === id && mail.unread)?.id;
}

export function shouldReloadOnMailDelta(tab: MailFilterTab) {
  // 未读筛选是一轮阅读清单；同步计数，但不要在阅读中重新筛掉当前清单。
  return tab !== "unread";
}

export function keepUnreadListItem(
  mail: Pick<MailItem, "id" | "unread">,
  readInView: ReadonlySet<string> | undefined,
) {
  return mail.unread || Boolean(readInView?.has(mail.id));
}
