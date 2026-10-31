import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import * as api from '../lib/bridge/mail';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { MailList } from './MailList';
import { MailToolbar } from './MailToolbar';
import { DEFAULT_MAIL_VIEW } from './mailView';
import { useMail, type MailController } from './useMail';
import type { MailFolder } from './WorkspaceSidebar';

vi.mock('../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../lib/bridge/mail')>()),
  accounts: vi.fn(),
  messages: vi.fn(),
  message: vi.fn(),
  setRead: vi.fn(),
  synchronize: vi.fn(),
  moveMessage: vi.fn(),
}));

const message = (index: number, read = false): api.MailSummary => ({
  id: `mail-${index}`,
  accountId: 'account-test',
  mailbox: 'INBOX',
  subject: `合成主题 ${index}`,
  from: 'sender@example.invalid',
  to: 'person@example.invalid',
  receivedAt: 1000 - index,
  read,
  starred: false,
  cached: true,
  hasAttachments: true,
});
let serverMessages: api.MailSummary[];
let syncTime: number;
let syncRunning: boolean;
let syncMore: boolean;
let syncError: string;
const flush = async () => act(async () => void (await Promise.resolve()));

function View({ mail }: { mail: MailController }) {
  return (
    <I18nProvider initialLocale="zh-CN">
      <MailToolbar controller={mail} count={mail.messages.length} onSync={() => void mail.sync()} />
      <MailList mail={mail} formatTime={() => '合成日期'} />
    </I18nProvider>
  );
}

const rows = () => within(screen.getByRole('region', { name: '邮件列表' }));
const row = (index: number) =>
  rows().getByRole('button', { name: new RegExp(`合成主题 ${index}\\n`) });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  serverMessages = [message(1), message(2), message(3, true)];
  syncTime = 1;
  syncRunning = false;
  syncMore = false;
  syncError = '';
  vi.mocked(api.accounts).mockImplementation(async () => [
    {
      id: 'account-test',
      providerCode: 'custom',
      email: 'person@example.invalid',
      displayName: '合成账号',
      status: AccountStatus.AccountConfigured,
      sync: { running: syncRunning, more: syncMore, errorCode: syncError, lastSyncAt: syncTime },
    },
  ]);
  vi.mocked(api.messages).mockImplementation(async (_account, _folder, offset) =>
    serverMessages.slice(offset, offset + 100).map((item) => ({ ...item })),
  );
  vi.mocked(api.message).mockImplementation(async (id) => ({
    ...message(Number(id.replace('mail-', ''))),
    id,
    body: '合成正文',
    attachments: [],
  }));
  vi.mocked(api.setRead).mockImplementation(async (id, read) => {
    serverMessages = serverMessages.map((item) => (item.id === id ? { ...item, read } : item));
  });
  vi.mocked(api.synchronize).mockResolvedValue(undefined);
  vi.mocked(api.moveMessage).mockImplementation(async (id) => {
    serverMessages = serverMessages.filter((item) => item.id !== id);
  });
});
afterEach(() => vi.useRealTimers());

it('未读筛选连续阅读多封后保留所有成员、高亮与前后导航，主动同步才移出', async () => {
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true }));
  const view = render(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题 3\n/ })).not.toBeInTheDocument();
  for (const index of [1, 2]) {
    act(() => result.current.setSelected(`mail-${index}`));
    await flush();
    await act(async () => result.current.markViewed(`mail-${index}`));
    view.rerender(<View mail={result.current} />);
    expect(row(index)).toHaveAttribute('data-read', 'true');
    expect(row(index)).toHaveAttribute('aria-pressed', 'true');
    expect(row(1)).toBeVisible();
    expect(row(2)).toBeVisible();
  }
  expect(result.current.messages.filter((item) => !item.read)).toHaveLength(0);
  await act(async () => result.current.markViewed('mail-2'));
  expect(api.setRead).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: '上一封' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '下一封' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '上一封' }));
  expect(result.current.selected).toBe('mail-1');
  await act(async () => result.current.sync());
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题/ })).not.toBeInTheDocument();
  expect(api.synchronize).toHaveBeenCalledOnce();
});

it('后台状态重验和内部 refresh 不重算未读成员，切换搜索或筛选条件才重算', async () => {
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true }));
  const view = render(<View mail={result.current} />);
  serverMessages = serverMessages.map((item) => ({ ...item, read: true }));
  syncTime++;
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  view.rerender(<View mail={result.current} />);
  expect(row(1)).toHaveAttribute('data-read', 'true');
  expect(row(2)).toBeVisible();
  act(() => result.current.refresh());
  await flush();
  view.rerender(<View mail={result.current} />);
  expect(row(1)).toBeVisible();
  serverMessages.unshift(message(4));
  act(() => result.current.refresh());
  await flush();
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题 4\n/ })).not.toBeInTheDocument();
  act(() => result.current.setFilter('合成'));
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题 1\n/ })).not.toBeInTheDocument();
  expect(row(4)).toBeVisible();
  act(() => result.current.setViewOptions(DEFAULT_MAIL_VIEW));
  view.rerender(<View mail={result.current} />);
  expect(row(1)).toBeVisible();
  expect(row(3)).toBeVisible();
});

it('下一页继续加入未读成员，不移出本轮已读成员；批量已读同样保持列表', async () => {
  serverMessages = Array.from({ length: 101 }, (_, index) => message(index + 1));
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true }));
  const view = render(<View mail={result.current} />);
  await act(async () => result.current.runAction('allRead', result.current.messages.slice(0, 2)));
  act(() => result.current.loadMore());
  await flush();
  view.rerender(<View mail={result.current} />);
  expect(row(1)).toHaveAttribute('data-read', 'true');
  expect(row(2)).toHaveAttribute('data-read', 'true');
  expect(row(101)).toHaveAttribute('data-read', 'false');
  expect(result.current.messages).toHaveLength(101);
  act(() =>
    result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true, oldestFirst: true }),
  );
  view.rerender(<View mail={result.current} />);
  expect(row(1)).toBeVisible();
  expect(row(101)).toBeVisible();
  act(() =>
    result.current.setViewOptions({
      ...DEFAULT_MAIL_VIEW,
      unreadOnly: true,
      attachmentsOnly: true,
    }),
  );
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题 1\n/ })).not.toBeInTheDocument();
  expect(row(101)).toBeVisible();
});

it('账号或分类切换开启新筛选会话，不沿用旧范围中已读邮件的成员身份', async () => {
  const { result, rerender } = renderHook(({ folder }: { folder: MailFolder }) => useMail(folder), {
    initialProps: { folder: 'inbox' },
  });
  await flush();
  act(() => result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true }));
  const view = render(<View mail={result.current} />);
  await act(async () => result.current.runAction('allRead', result.current.messages.slice(0, 2)));
  view.rerender(<View mail={result.current} />);
  expect(row(1)).toBeVisible();
  act(() => result.current.chooseAccount('account-test'));
  await flush();
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题/ })).not.toBeInTheDocument();
  serverMessages = serverMessages.map((item) => ({ ...item, read: false }));
  act(() => rerender({ folder: 'sent' }));
  await flush();
  view.rerender(<View mail={result.current} />);
  expect(row(1)).toBeVisible();
});

it('本轮成员被明确归档时仍移出，不保留已经移动的幽灵条目', async () => {
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true }));
  act(() => result.current.setSelected('mail-1'));
  const view = render(<View mail={result.current} />);
  await act(async () => result.current.runAction('archive', result.current.messages.slice(0, 1)));
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题 1\n/ })).not.toBeInTheDocument();
  expect(row(2)).toBeVisible();
  expect(result.current.selected).toBe('');
  expect(api.moveMessage).toHaveBeenCalledExactlyOnceWith('mail-1', 'archive');
});

it('主动同步期间纳入新未读，完成后再次冻结，并保留同步期间已读的既有成员', async () => {
  vi.mocked(api.synchronize).mockImplementationOnce(async () => {
    syncRunning = true;
  });
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true }));
  const view = render(<View mail={result.current} />);
  await act(async () => result.current.sync());
  serverMessages.unshift(message(4));
  syncTime++;
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  view.rerender(<View mail={result.current} />);
  expect(row(4)).toBeVisible();
  act(() => result.current.setSelected('mail-1'));
  await flush();
  await act(async () => result.current.markViewed('mail-1'));
  syncRunning = false;
  syncTime++;
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  view.rerender(<View mail={result.current} />);
  expect(row(1)).toHaveAttribute('data-read', 'true');
  serverMessages.unshift(message(5));
  syncTime++;
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题 5\n/ })).not.toBeInTheDocument();
  await act(async () => result.current.sync());
  view.rerender(<View mail={result.current} />);
  expect(row(5)).toBeVisible();
  expect(rows().queryByRole('button', { name: /合成主题 1\n/ })).not.toBeInTheDocument();
});

it('主动同步很快结束且状态时间戳不变时，也会结束刷新窗口', async () => {
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true }));
  const view = render(<View mail={result.current} />);
  await act(async () => result.current.sync());
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  serverMessages.unshift(message(4));
  act(() => result.current.refresh());
  await flush();
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题 4\n/ })).not.toBeInTheDocument();
  expect(row(1)).toBeVisible();
});

it.each(['request', 'status'])('同步 %s 失败后不永久接纳后台新到邮件', async (failure) => {
  if (failure === 'request')
    vi.mocked(api.synchronize).mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  else
    vi.mocked(api.synchronize).mockImplementationOnce(async () => {
      syncError = 'NETWORK_FAILED';
      syncMore = true;
      syncTime++;
    });
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setViewOptions({ ...DEFAULT_MAIL_VIEW, unreadOnly: true }));
  const view = render(<View mail={result.current} />);
  await act(async () => result.current.sync());
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  serverMessages.unshift(message(4));
  act(() => result.current.refresh());
  await flush();
  view.rerender(<View mail={result.current} />);
  expect(rows().queryByRole('button', { name: /合成主题 4\n/ })).not.toBeInTheDocument();
  expect(row(1)).toBeVisible();
});
