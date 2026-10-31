import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { MailDetail } from '../lib/bridge/mail';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { MailReaderPage } from './MailReaderPage';

vi.mock('./MailBody', () => ({ MailBody: ({ text }: { text: string }) => <p>{text}</p> }));

const detail: MailDetail = {
  id: 'synthetic-mail',
  accountId: 'synthetic-account',
  mailbox: 'INBOX',
  subject: '受限邮件',
  from: 'from@example.invalid',
  to: 'to@example.invalid',
  receivedAt: 1,
  read: false,
  starred: false,
  cached: false,
  body: '',
  bodyVersion: 0,
  bodyErrorCode: 'MESSAGE_TEXT_TOO_LARGE',
  attachments: [],
};
it('受限正文保留摘要与原因，只提供显式单封重取而非无效的旧缓存升级提示', () => {
  const refresh = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailReaderPage
        detail={detail}
        busy={false}
        onRefresh={refresh}
        options={{ interactive: true, transitionManaged: false }}
      />
    </I18nProvider>,
  );
  expect(screen.getByText('受限邮件')).toBeVisible();
  expect(screen.getByText(/正文总量超过 8 MiB/)).toBeVisible();
  expect(screen.queryByRole('button', { name: '重新获取完整邮件' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重新读取这封邮件' }));
  expect(refresh).toHaveBeenCalledOnce();
});
it('原始邮件明确大于 100 MiB 时不重复下载；旧本地正文仍可阅读', () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailReaderPage
        detail={{
          ...detail,
          cached: true,
          body: '已有本地正文',
          bodyVersion: 1,
          bodyErrorCode: 'MESSAGE_RAW_TOO_LARGE',
        }}
        busy={false}
        onRefresh={vi.fn()}
        options={{ interactive: true, transitionManaged: false }}
      />
    </I18nProvider>,
  );
  expect(screen.getByText('已有本地正文')).toBeVisible();
  expect(screen.getByText(/原始邮件超过 100 MiB/)).toBeVisible();
  expect(screen.queryByRole('button', { name: '重新读取这封邮件' })).not.toBeInTheDocument();
});
