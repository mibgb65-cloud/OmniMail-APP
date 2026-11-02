import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import type { AccountSummary } from '../lib/bridge/mail';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { WorkspaceSidebar } from './WorkspaceSidebar';

const account = (id: string, providerCode: string): AccountSummary => ({
  id,
  providerCode,
  email: `${id}@example.invalid`,
  displayName: id,
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 1 },
});
const values = [
  account('gmail-one', 'gmail'),
  account('gmail-two', 'gmail'),
  account('yahoo-one', 'yahoo'),
  account('netease-126', 'netease_126'),
  account('netease-163', 'netease_163'),
  account('custom-one', 'custom'),
  account('future-one', 'constructor'),
  account('reserved-one', 'providers'),
];
function setup(accounts = values, locale: 'zh-CN' | 'en' = 'zh-CN') {
  const select = vi.fn(),
    retry = vi.fn().mockResolvedValue(undefined);
  const content = (next = accounts) => (
    <I18nProvider initialLocale={locale}>
      <WorkspaceSidebar
        themePreference="light"
        onThemePreferenceChange={vi.fn(() => true)}
        selectedFolder="inbox"
        onSelectFolder={vi.fn()}
        accounts={next}
        selectedAccount="gmail-two"
        mailReady
        onSelectAccount={select}
        onRetryAccount={retry}
        onAddAccount={vi.fn()}
      />
    </I18nProvider>
  );
  return { ...render(content()), content, select, retry };
}

it('切换、进入与返回只改变浏览层，明确选账号才触发业务选择', () => {
  const { select } = setup();
  expect(screen.getByRole('button', { name: 'gmail-one' })).toBeVisible();
  const toggle = screen.getByRole('button', { name: '按服务商分组' });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'gmail-one' })).not.toBeInTheDocument();
  const gmail = screen.getByRole('button', { name: '进入 Gmail' });
  expect(gmail).toHaveAccessibleDescription(/2 个邮箱/);
  fireEvent.click(gmail);
  const back = screen.getByRole('button', { name: '返回服务商列表' });
  expect(back).toHaveFocus();
  expect(screen.getByRole('button', { name: 'gmail-two' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'yahoo-one' })).not.toBeInTheDocument();
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(back);
  expect(screen.getByRole('button', { name: '进入 Gmail' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '进入 Yahoo Mail' }));
  fireEvent.click(screen.getByRole('button', { name: 'yahoo-one' }));
  expect(select).toHaveBeenCalledExactlyOnceWith('yahoo-one');
});

it('网易子预设合为品牌组，custom 和未知代码不按域名猜测或命中对象原型', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '按服务商分组' }));
  expect(screen.getByRole('button', { name: '进入 网易邮箱' })).toHaveAccessibleDescription(
    '2 个邮箱',
  );
  expect(screen.getByRole('button', { name: '进入 自定义 IMAP/SMTP' })).toBeVisible();
  expect(screen.getByRole('button', { name: '进入 constructor' })).toBeVisible();
  expect(screen.getByRole('button', { name: '进入 providers' })).toBeVisible();
  const indexViewport = screen
    .getByRole('button', { name: '进入 providers' })
    .closest('[data-custom-scrollbar]');
  fireEvent.click(screen.getByRole('button', { name: '进入 providers' }));
  expect(
    screen.getByRole('button', { name: 'reserved-one' }).closest('[data-custom-scrollbar]'),
  ).not.toBe(indexViewport);
  fireEvent.click(screen.getByRole('button', { name: '返回服务商列表' }));
  fireEvent.click(screen.getByRole('button', { name: '进入 网易邮箱' }));
  expect(screen.getByRole('button', { name: 'netease-126' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'netease-163' })).toBeVisible();
});

it('全部邮箱始终为全局选择，模式重入回到服务商入口而不残留内层', () => {
  const { select } = setup();
  const toggle = screen.getByRole('button', { name: '按服务商分组' });
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: '进入 Gmail' }));
  fireEvent.click(screen.getByRole('button', { name: '全部邮箱' }));
  expect(select).toHaveBeenCalledExactlyOnceWith('');
  expect(screen.getByRole('button', { name: '进入 Yahoo Mail' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '进入 Gmail' }));
  fireEvent.click(toggle);
  expect(screen.getByRole('button', { name: 'yahoo-one' })).toBeVisible();
  fireEvent.click(toggle);
  expect(screen.queryByRole('button', { name: '返回服务商列表' })).not.toBeInTheDocument();
  expect(select).toHaveBeenCalledTimes(1);
});

it('组内状态重试沿用真实账号，移除当前整组安全返回且重加不自动进入', async () => {
  const failed = values.map((value) =>
    value.id === 'gmail-one'
      ? { ...value, sync: { ...value.sync, errorCode: 'NETWORK_FAILED' } }
      : value,
  );
  const { content, rerender, select, retry } = setup(failed);
  fireEvent.click(screen.getByRole('button', { name: '按服务商分组' }));
  fireEvent.click(screen.getByRole('button', { name: '进入 Gmail' }));
  fireEvent.click(screen.getByRole('button', { name: 'gmail-one@example.invalid · 同步失败' }));
  const dialog = screen.getByRole('dialog', { name: '同步失败' });
  fireEvent.click(within(dialog).getByRole('button', { name: '重新同步' }));
  await waitFor(() => expect(retry).toHaveBeenCalledExactlyOnceWith('gmail-one'));
  expect(select).not.toHaveBeenCalled();
  rerender(content(failed.filter((value) => value.providerCode !== 'gmail')));
  expect(screen.queryByRole('button', { name: '返回服务商列表' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '进入 Yahoo Mail' })).toBeVisible();
  rerender(content(failed));
  expect(screen.getByRole('button', { name: '进入 Gmail' })).toBeVisible();
});

it('英文也能分组和返回，禁用空列表切换而不隐藏管理/添加入口', () => {
  const view = setup(values, 'en');
  fireEvent.click(screen.getByRole('button', { name: 'Group mailboxes by provider' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open Gmail' }));
  expect(screen.getByRole('button', { name: 'Back to providers' })).toBeVisible();
  view.unmount();
  setup([]);
  expect(screen.getByRole('button', { name: '按服务商分组' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '管理邮箱账号' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '添加邮箱' })).toBeEnabled();
});
