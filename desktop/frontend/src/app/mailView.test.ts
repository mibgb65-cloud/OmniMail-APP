import { expect, it } from 'vitest';
import type { MailSummary } from '../lib/bridge/mail';
import { DEFAULT_MAIL_VIEW, selectMailView } from './mailView';

const messages: MailSummary[] = [1, 2, 3].map((i) => ({
  id: `${i}`,
  accountId: 'a',
  mailbox: 'INBOX',
  subject: `邮件 ${i}`,
  from: 'a@example.invalid',
  to: 'b@example.invalid',
  receivedAt: i,
  read: i === 2,
  starred: false,
  cached: true,
  hasAttachments: i !== 1,
}));
it('已加载邮件搜索、未读和附件可组合，时间顺序不修改源数组', () => {
  expect(selectMailView(messages, '', DEFAULT_MAIL_VIEW).map((m) => m.id)).toEqual(['3', '2', '1']);
  expect(
    selectMailView(messages, '', {
      ...DEFAULT_MAIL_VIEW,
      unreadOnly: true,
      attachmentsOnly: true,
    }).map((m) => m.id),
  ).toEqual(['3']);
  expect(selectMailView(messages, '邮件 2', DEFAULT_MAIL_VIEW).map((m) => m.id)).toEqual(['2']);
  expect(
    selectMailView(messages, '', { ...DEFAULT_MAIL_VIEW, oldestFirst: true }).map((m) => m.id),
  ).toEqual(['1', '2', '3']);
  expect(messages.map((m) => m.id)).toEqual(['1', '2', '3']);
});
