import { fireEvent, render, screen } from '@testing-library/react';
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
        theme="light"
        onToggleTheme={vi.fn()}
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
] as const)('邮箱 %s 状态使用短标签和关联说明，不把整段错误挤进账号行', (state, label) => {
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
  expect(screen.getByText(label)).toBeVisible();
  expect(screen.getByRole('button', { name: '工作邮箱' })).toHaveAccessibleDescription(label);
  expect(document.querySelector('[title]')).toBeNull();
});

it('保留全部邮箱与单账号选择，断开必须先确认且不嵌套在选择按钮内', () => {
  const { select, disconnect } = setup();
  fireEvent.click(screen.getByRole('button', { name: '全部邮箱' }));
  fireEvent.click(screen.getByRole('button', { name: '工作邮箱' }));
  expect(select.mock.calls).toEqual([[''], [account.id]]);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const action = screen.getByRole('button', { name: /断开.*work@example.invalid/ });
  expect(action.parentElement?.closest('button')).toBeNull();
  fireEvent.click(action);
  expect(confirm).toHaveBeenCalledOnce();
  expect(disconnect).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(action);
  expect(disconnect).toHaveBeenCalledWith(account.id);
});

it('英语状态也使用简洁标签，断开账号不显示再次断开的入口', () => {
  setup({ ...account, status: AccountStatus.AccountDisconnected }, 'en');
  expect(screen.getByText('Disconnected')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Disconnect:/ })).not.toBeInTheDocument();
});

it('已接入邮箱的分类提示说明真实查看能力，不再声称邮件功能尚未接入', () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <WorkspaceSidebar
        theme="light"
        onToggleTheme={vi.fn()}
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
