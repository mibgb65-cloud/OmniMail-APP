import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { VERSION_INFO } from '../../test/fixtures';
import { SettingsDialog } from './SettingsDialog';

function renderSettings(onManageAccounts?: () => void, accountCount?: number) {
  const onClose = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <SettingsDialog
        themePreference="system"
        onThemePreferenceChange={vi.fn(() => true)}
        onClose={onClose}
        versionInfo={VERSION_INFO}
        onManageAccounts={onManageAccounts}
        accountCount={accountCount}
      />
    </I18nProvider>,
  );
  return onClose;
}
it('邮箱设置显示真实数量，完成退出后才转到管理窗口', async () => {
  const manage = vi.fn();
  const close = renderSettings(manage, 2);
  fireEvent.click(screen.getByRole('tab', { name: '邮箱设置' }));
  expect(screen.getByText('2 个邮箱')).toBeVisible();
  let finish: () => void = () => {};
  const dialog = screen.getByRole('dialog', { name: '设置' });
  Object.defineProperty(dialog, 'getAnimations', {
    configurable: true,
    value: () => [
      {
        finished: new Promise<void>((resolve) => {
          finish = resolve;
        }),
        effect: { target: dialog, getComputedTiming: () => ({ endTime: 140 }) },
      },
    ],
  });
  fireEvent.click(screen.getByRole('button', { name: '管理邮箱' }));
  expect(manage).not.toHaveBeenCalled();
  finish();
  await waitFor(() => expect(manage).toHaveBeenCalledOnce());
  expect(close).toHaveBeenCalledOnce();
  expect(close.mock.invocationCallOrder[0]).toBeLessThan(manage.mock.invocationCallOrder[0] ?? 0);
});
it('未连接邮件服务不提供无效管理入口，通知与 AI 不伪造开关', () => {
  renderSettings();
  fireEvent.click(screen.getByRole('tab', { name: '邮箱设置' }));
  expect(screen.getByRole('button', { name: '管理邮箱' })).toBeDisabled();
  expect(screen.getByText('桌面邮件服务尚未连接。')).toBeVisible();
  for (const name of ['通知设置', 'AI 设置']) {
    fireEvent.click(screen.getByRole('tab', { name }));
    const panel = screen.getByRole('tabpanel', { name });
    expect(within(panel).getByText('暂未接入')).toBeVisible();
    expect(within(panel).queryByRole('switch')).not.toBeInTheDocument();
  }
});
it('更新页显示安装版本，不把未接入宣称为最新版本', () => {
  renderSettings();
  fireEvent.click(screen.getByRole('tab', { name: '软件更新' }));
  const panel = screen.getByRole('tabpanel', { name: '软件更新' });
  expect(within(panel).getByText(VERSION_INFO.version)).toBeVisible();
  expect(within(panel).getByText(/此状态不代表你已使用最新版本/)).toBeVisible();
});
