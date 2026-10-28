import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import type { MailController } from './useMail';
import { MailWorkspace } from './MailWorkspace';

it('真实邮件视图替换占位阅读器，正文始终作为文本而不是 HTML', () => {
  const message = {
    id: 'mail-test',
    accountId: 'account-test',
    mailbox: 'INBOX',
    subject: '真实主题',
    from: 'sender@example.invalid',
    to: 'person@example.invalid',
    receivedAt: 1,
    read: false,
    starred: false,
    cached: true,
  };
  const controller: MailController = {
    ready: true,
    accounts: [],
    accountId: '',
    chooseAccount: vi.fn(),
    messages: [message],
    detail: { ...message, body: '<script>not-executed()</script>', attachments: [] },
    selected: message.id,
    setSelected: vi.fn(),
    error: undefined,
    bodyError: undefined,
    loading: false,
    offset: 0,
    nextPage: vi.fn(),
    refresh: vi.fn(),
    sync: vi.fn(),
    filter: '',
    setFilter: vi.fn(),
    resetView: vi.fn(),
    disconnectAccount: vi.fn(),
  };
  const { container } = render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={controller} />
    </I18nProvider>,
  );
  expect(screen.getByRole('heading', { name: '真实主题' })).toBeVisible();
  expect(screen.getByText('<script>not-executed()</script>')).toBeVisible();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.queryByText('选择邮件后，可在这里查看内容。')).not.toBeInTheDocument();
});
