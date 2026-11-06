import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import type { AccountSummary } from '../lib/bridge/mail';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { WorkspaceSidebar } from './WorkspaceSidebar';

const account: AccountSummary = {
  id: 'account-test',
  providerCode: 'qq',
  email: 'work@example.invalid',
  displayName: '工作邮箱',
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
};
function setup(value = account, locale: 'zh-CN' | 'en' = 'zh-CN') {
  const select = vi.fn(),
    disconnect = vi.fn();
  render(
    <I18nProvider initialLocale={locale}>
      <WorkspaceSidebar
        themePreference="light"
        onThemePreferenceChange={vi.fn(() => true)}
        selectedFolder="inbox"
        onSelectFolder={vi.fn()}
        accounts={[value]}
        selectedAccount=""
        onSelectAccount={select}
        onDisconnect={disconnect}
        onAddAccount={vi.fn()}
      />
    </I18nProvider>,
  );
  return { select, disconnect };
}
afterEach(() => vi.restoreAllMocks());

it.each([
  ['idle', '尚未同步'],
  ['running', '正在同步'],
  ['error', '同步失败'],
  ['reauth', '需要重新登录'],
  ['disconnected', '已断开'],
] as const)('邮箱 %s 状态使用单行状态点和关联说明', (state, label) => {
  setup({
    ...account,
    status:
      state === 'reauth'
        ? AccountStatus.AccountReauth
        : state === 'disconnected'
          ? AccountStatus.AccountDisconnected
          : account.status,
    sync: {
      ...account.sync,
      running: state === 'running',
      errorCode: state === 'error' ? 'NETWORK_FAILED' : '',
    },
  });
  expect(screen.getByRole('button', { name: '工作邮箱' })).toHaveAccessibleDescription(label);
  const status = screen.getByRole('button', { name: `work@example.invalid · ${label}` });
  expect(status).toHaveAttribute('data-state', state);
  expect(status).not.toHaveTextContent(label);
  expect(document.querySelector('[title]')).toBeNull();
});

it('外侧账号行只有选择和状态，断开入口仅在我的邮箱设置中且仍需确认', async () => {
  const { select, disconnect } = setup();
  fireEvent.click(screen.getByRole('button', { name: '全部邮箱' }));
  fireEvent.click(screen.getByRole('button', { name: '工作邮箱' }));
  expect(select.mock.calls).toEqual([[''], [account.id]]);
  expect(
    screen.queryByRole('button', { name: /断开.*work@example.invalid/ }),
  ).not.toBeInTheDocument();
  const manage = screen.getByRole('button', { name: '管理邮箱账号' });
  expect(manage).toHaveAttribute('data-tooltip', '管理邮箱账号');
  fireEvent.click(manage);
  expect(screen.getByRole('dialog', { name: '邮箱账号管理' })).toHaveAttribute(
    'data-dialog-frame',
    'standard',
  );
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const action = screen.getByRole('button', { name: /断开.*work@example.invalid/ });
  expect(action.parentElement?.closest('button')).toBeNull();
  fireEvent.click(action);
  const dialog = screen.getByRole('dialog', { name: '断开邮箱账号？' });
  expect(dialog).toHaveAttribute('data-dialog-frame', 'standard');
  expect(within(dialog).getByText(account.email)).toBeVisible();
  expect(within(dialog).getByText(/已下载的邮件会保留/)).toBeVisible();
  expect(within(dialog).getByRole('button', { name: '取消' })).toHaveFocus();
  expect(confirm).not.toHaveBeenCalled();
  expect(disconnect).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '断开邮箱账号？' })).not.toBeInTheDocument(),
  );
  expect(disconnect).not.toHaveBeenCalled();
  fireEvent.click(action);
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '断开邮箱账号？' })).getByRole('button', {
      name: '断开账号',
    }),
  );
  expect(disconnect).toHaveBeenCalledExactlyOnceWith(account.id);
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '断开邮箱账号？' })).not.toBeInTheDocument(),
  );
  expect(select.mock.calls).toEqual([[''], [account.id]]);
  fireEvent.click(screen.getByRole('button', { name: '完成' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(manage).toHaveFocus();
});

it('Esc 取消断开确认，不清除凭据', async () => {
  const { disconnect } = setup();
  fireEvent.click(screen.getByRole('button', { name: '管理邮箱账号' }));
  fireEvent.click(screen.getByRole('button', { name: /断开.*work@example.invalid/ }));
  fireEvent(
    screen.getByRole('dialog', { name: '断开邮箱账号？' }),
    new Event('cancel', { cancelable: true }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '断开邮箱账号？' })).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('dialog', { name: '邮箱账号管理' })).toBeVisible();
  expect(disconnect).not.toHaveBeenCalled();
});

it('确认框的 Tab 与 Shift+Tab 在取消和确认之间循环', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '管理邮箱账号' }));
  fireEvent.click(screen.getByRole('button', { name: /断开.*work@example.invalid/ }));
  const dialog = screen.getByRole('dialog', { name: '断开邮箱账号？' });
  const cancel = within(dialog).getByRole('button', { name: '取消' });
  const confirm = within(dialog).getByRole('button', { name: '断开账号' });
  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(confirm).toHaveFocus();
  fireEvent.keyDown(confirm, { key: 'Tab' });
  expect(cancel).toHaveFocus();
});

it('英语状态也使用简洁标签，断开账号不显示再次断开的入口', () => {
  setup({ ...account, status: AccountStatus.AccountDisconnected }, 'en');
  expect(screen.getByRole('button', { name: /work@example.invalid · Disconnected/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Disconnect:/ })).not.toBeInTheDocument();
});

it('已接入邮箱的分类提示说明真实查看能力，不再声称邮件功能尚未接入', () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <WorkspaceSidebar
        themePreference="light"
        onThemePreferenceChange={vi.fn(() => true)}
        selectedFolder="inbox"
        onSelectFolder={vi.fn()}
        accounts={[account]}
        mailReady
        onSelectAccount={vi.fn()}
      />
    </I18nProvider>,
  );
  expect(screen.getByRole('button', { name: '全部收件箱' })).toHaveAttribute(
    'data-tooltip',
    '查看全部收件箱',
  );
});

it('账号尚未读取时不把未知数据展示成没有账号，已读取的空列表仍可管理', async () => {
  const props = {
    themePreference: 'light' as const,
    onThemePreferenceChange: vi.fn(() => true),
    selectedFolder: 'inbox' as const,
    onSelectFolder: vi.fn(),
    accounts: [],
  };
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <WorkspaceSidebar {...props} />
    </I18nProvider>,
  );
  expect(screen.getByRole('button', { name: '管理邮箱账号' })).toBeDisabled();
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <WorkspaceSidebar {...props} mailReady />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '管理邮箱账号' }));
  expect(screen.getByRole('dialog', { name: '邮箱账号管理' })).toHaveTextContent('还没有添加邮箱');
});
