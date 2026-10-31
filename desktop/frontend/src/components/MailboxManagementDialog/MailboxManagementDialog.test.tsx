import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AccountStatus } from '../../../bindings/omnimail/desktop/internal/domain/models';
import type { AccountSummary } from '../../lib/bridge/mail';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { MailboxManagementDialog } from './MailboxManagementDialog';

const account: AccountSummary = {
  id: 'first',
  email: 'work@example.invalid',
  displayName: '工作邮箱',
  providerCode: 'naver',
  messageCount: 42,
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 1 },
};
const other: AccountSummary = {
  ...account,
  id: 'second',
  email: 'second@example.invalid',
  displayName: '',
  status: AccountStatus.AccountDisconnected,
};
const setup = (
  disconnect: (id: string) => Promise<void> = vi.fn().mockResolvedValue(undefined),
  initial = [account, other],
  locale: 'zh-CN' | 'en' = 'zh-CN',
) => {
  const close = vi.fn(),
    add = vi.fn(),
    sync = vi.fn().mockResolvedValue(undefined);
  function Harness() {
    const [accounts, setAccounts] = useState(initial);
    return (
      <I18nProvider initialLocale={locale}>
        <MailboxManagementDialog
          accounts={accounts}
          selectedAccount={account.id}
          onDisconnect={async (id) => {
            await disconnect(id);
            setAccounts((rows) =>
              rows.map((row) =>
                row.id === id ? { ...row, status: AccountStatus.AccountDisconnected } : row,
              ),
            );
          }}
          onRetryAccount={sync}
          onAddAccount={add}
          onClose={close}
        />
      </I18nProvider>
    );
  }
  render(<Harness />);
  return { close, add, sync };
};

it('管理选择独立于工作区，显示完整邮箱、服务商、真实数量，已断开账号没有重复断开', () => {
  const { sync } = setup();
  const dialog = screen.getByRole('dialog', { name: '邮箱账号管理' });
  expect(within(dialog).getByRole('button', { name: account.email })).toHaveFocus();
  expect(
    within(within(dialog).getByRole('region', { name: '账号概览' })).getByText('NAVER Mail'),
  ).toBeVisible();
  expect(within(dialog).getByText('42 封')).toBeVisible();
  fireEvent.click(within(dialog).getByRole('button', { name: other.email }));
  expect(within(dialog).getByText('已断开')).toBeVisible();
  expect(within(dialog).queryByRole('button', { name: /断开账号:/ })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: account.email }));
  fireEvent.click(within(dialog).getByRole('button', { name: '重新同步' }));
  expect(sync).toHaveBeenCalledExactlyOnceWith(account.id);
});

it('确认后的异步失败局部展示并允许重试，处理中禁止重复执行及关闭', async () => {
  let fail: ((error: Error) => void) | undefined;
  const disconnect = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
  );
  const { close } = setup(disconnect);
  const dialog = screen.getByRole('dialog', { name: '邮箱账号管理' });
  fireEvent.click(screen.getByRole('button', { name: `断开账号: ${account.email}` }));
  const confirmation = screen.getByRole('dialog', { name: '断开邮箱账号？' });
  const confirm = within(confirmation).getByRole('button', { name: '断开账号' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '断开邮箱账号？' })).not.toBeInTheDocument(),
  );
  expect(disconnect).toHaveBeenCalledExactlyOnceWith(account.id);
  expect(within(dialog).getByRole('button', { name: '完成' })).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: other.email })).toBeDisabled();
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(close).not.toHaveBeenCalled();
  await act(async () => {
    fail?.(new Error('NETWORK_FAILED private-server-token'));
  });
  expect(within(dialog).getByRole('alert')).toHaveTextContent('无法连接邮件服务器');
  expect(within(dialog).getByRole('alert')).not.toHaveTextContent('private-server-token');
  expect(within(dialog).getByRole('button', { name: '完成' })).toBeEnabled();
  expect(within(dialog).getByRole('button', { name: `断开账号: ${account.email}` })).toHaveFocus();
});

it('成功断开只执行一次，刷新详情并保留管理窗口及本地邮件数量', async () => {
  const disconnect = vi.fn().mockResolvedValue(undefined);
  setup(disconnect);
  fireEvent.click(screen.getByRole('button', { name: `断开账号: ${account.email}` }));
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '断开邮箱账号？' })).getByRole('button', {
      name: '断开账号',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '断开邮箱账号？' })).not.toBeInTheDocument(),
  );
  const dialog = screen.getByRole('dialog', { name: '邮箱账号管理' });
  expect(within(dialog).getByText('已断开')).toBeVisible();
  expect(within(dialog).getByText('42 封')).toBeVisible();
  expect(
    within(dialog).queryByRole('button', { name: `断开账号: ${account.email}` }),
  ).not.toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: '完成' })).toHaveFocus();
  expect(disconnect).toHaveBeenCalledOnce();
});

it('管理窗键盘焦点循环，新增先关闭管理窗再复用添加向导', async () => {
  const events: string[] = [];
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailboxManagementDialog
        accounts={[account]}
        selectedAccount={account.id}
        onAddAccount={() => events.push('add')}
        onClose={() => events.push('closed')}
      />
    </I18nProvider>,
  );
  const first = screen.getByRole('button', { name: account.email });
  const done = screen.getByRole('button', { name: '完成' });
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(done).toHaveFocus();
  fireEvent.keyDown(done, { key: 'Tab' });
  expect(first).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '添加邮箱账号' }));
  await waitFor(() => expect(events).toEqual(['closed', 'add']));
});

it('空列表与英语可用，不显示未接线的删除、编辑或重连操作', () => {
  setup(undefined, [], 'en');
  expect(screen.getByRole('dialog', { name: 'Email account management' })).toBeVisible();
  expect(screen.getByText(/No email accounts yet/)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Delete|Edit|Reconnect/ })).not.toBeInTheDocument();
});
