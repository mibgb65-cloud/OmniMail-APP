import { useState } from 'react';
import type { MailSummary } from '../lib/bridge/mail';
import { selectMailView, type MailViewOptions } from './mailView';

interface UnreadSnapshot {
  key: string;
  known: Set<string>;
  unread: Set<string>;
  pageCount: number;
}

export function useMailView(
  messages: MailSummary[],
  scope: string,
  query: string,
  options: MailViewOptions,
  pageCount: number,
  acceptingNew = false,
) {
  const key = JSON.stringify([scope, query, options.unreadOnly, options.attachmentsOnly]);
  const [snapshot, setSnapshot] = useState<UnreadSnapshot>({
    key: '',
    known: new Set(),
    unread: new Set(),
    pageCount: 0,
  });
  const ids = new Set(options.unreadOnly ? messages.map((message) => message.id) : []);
  let current = snapshot;
  if (
    snapshot.key !== key ||
    snapshot.pageCount !== pageCount ||
    snapshot.known.size !== ids.size ||
    [...ids].some((id) => !snapshot.known.has(id))
  ) {
    const previous = snapshot.key === key ? snapshot : undefined;
    // 新会话/首次加载/用户翻页可扩展成员；同页后台刷新新增的邮件等待主动同步或条件变化。
    const allowNew =
      acceptingNew || !previous || previous.pageCount === 0 || pageCount > previous.pageCount;
    current = {
      key,
      known: ids,
      pageCount,
      unread: new Set(
        messages
          .filter((message) =>
            previous?.known.has(message.id)
              ? previous.unread.has(message.id)
              : allowNew && !message.read && ids.has(message.id),
          )
          .map((message) => message.id),
      ),
    };
    // 仅在范围/成员变化时调整本组件状态，避免筛选切换先闪回上一轮结果；不复制或伪造 read。
    setSnapshot(current);
  }
  const candidates = options.unreadOnly
    ? messages.filter((message) => current.unread.has(message.id))
    : messages;
  return selectMailView(candidates, query, { ...options, unreadOnly: false });
}
