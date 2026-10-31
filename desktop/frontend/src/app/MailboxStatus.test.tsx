import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import type { AccountSummary } from '../lib/bridge/mail';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { MailboxStatus } from './MailboxStatus';

const account: AccountSummary = {
  id: 'account-test',
  email: 'work@example.invalid',
  displayName: '',
  providerCode: 'qq',
  status: AccountStatus.AccountConfigured,
  messageCount: 123,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 1 },
};
const setup = (value = account, retry = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailboxStatus account={value} onRetry={retry} />
    </I18nProvider>,
  );
  return retry;
};

it.each([0, 123])('成功状态可悬浮或聚焦显示真实数量 %s，且不使用原生 title', (count) => {
  setup({ ...account, messageCount: count });
  const trigger = screen.getByRole('button', { name: /work@example.invalid.*已同步/ });
  expect(trigger).toHaveAttribute('data-state', 'ready');
  fireEvent.mouseEnter(trigger);
  const panel = screen.getByRole('dialog', { name: /已同步/ });
  expect(within(panel).getByText(`已同步 ${count} 封邮件`)).toBeVisible();
  expect(within(panel).getByText(account.email)).toBeVisible();
  expect(document.querySelector('[title]')).toBeNull();
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.focus(trigger);
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('未知数量不伪造成零，仍提供已同步说明', () => {
  setup({ ...account, messageCount: undefined });
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toHaveTextContent('已同步');
  expect(screen.queryByText(/0 封邮件/)).not.toBeInTheDocument();
});

it('存在受限邮件时不显示绿色成功或重复重试按钮，说明真实未完整数量', () => {
  setup({ ...account, limitedMessageCount: 2 });
  const trigger = screen.getByRole('button', { name: /部分邮件未完整下载/ });
  expect(trigger).toHaveAttribute('data-state', 'limited');
  fireEvent.focus(trigger);
  expect(screen.getByRole('dialog')).toHaveTextContent('2 封邮件未完整下载');
  expect(screen.queryByText('已同步 123 封邮件')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重新同步' })).not.toBeInTheDocument();
});
it('仅鼠标悬浮、焦点不在浮层内时，Esc 也能关闭状态说明', () => {
  setup();
  fireEvent.mouseEnter(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('失败悬浮层可点击和键盘重试，阻止重复请求且不泄露错误详情', async () => {
  let finish: (() => void) | undefined;
  const retry = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  setup({ ...account, sync: { ...account.sync, errorCode: 'NETWORK_FAILED' } }, retry);
  const trigger = screen.getByRole('button', { name: /同步失败/ });
  fireEvent.click(trigger);
  const action = screen.getByRole('button', { name: '重新同步' });
  fireEvent.mouseLeave(trigger, { relatedTarget: action });
  fireEvent.mouseEnter(screen.getByRole('dialog'));
  fireEvent.click(action);
  fireEvent.click(action);
  expect(retry).toHaveBeenCalledExactlyOnceWith(account.id);
  expect(action).toBeDisabled();
  finish?.();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('重试失败保留可操作悬浮层，只显示映射后的安全错误', async () => {
  const retry = setup(
    { ...account, sync: { ...account.sync, errorCode: 'NETWORK_FAILED' } },
    vi.fn().mockRejectedValue(new Error('TIMEOUT private-token')),
  );
  fireEvent.focus(screen.getByRole('button'));
  fireEvent.click(screen.getByRole('button', { name: '重新同步' }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private-token');
  expect(screen.getByRole('button', { name: '重新同步' })).toBeEnabled();
  expect(retry).toHaveBeenCalledOnce();
});

it('Tab 从状态点进入重试，Esc 关闭并恢复状态点焦点', () => {
  setup({ ...account, sync: { ...account.sync, errorCode: 'NETWORK_FAILED' } });
  const trigger = screen.getByRole('button', { name: /同步失败/ });
  fireEvent.focus(trigger);
  fireEvent.keyDown(trigger, { key: 'Tab' });
  expect(screen.getByRole('button', { name: '重新同步' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it.each([
  [AccountStatus.AccountReauth, '需要重新登录'],
  [AccountStatus.AccountDisconnected, '已断开'],
] as const)('%s 状态不提供无效重试入口', (status, label) => {
  setup({ ...account, status, sync: { ...account.sync, errorCode: 'AUTH_INVALID' } });
  fireEvent.focus(screen.getByRole('button', { name: new RegExp(label) }));
  expect(screen.getByRole('dialog')).toHaveAccessibleName(label);
  expect(screen.queryByRole('button', { name: '重新同步' })).not.toBeInTheDocument();
});

it.each([1, 2])('英文同步数量 %s 使用正确单复数', (count) => {
  render(
    <I18nProvider initialLocale="en">
      <MailboxStatus account={{ ...account, messageCount: count }} />
    </I18nProvider>,
  );
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toHaveTextContent(
    `Synced ${count} ${count === 1 ? 'message' : 'messages'}`,
  );
});
