import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { cancelWindowClose, resolveWindowClose } from '../../lib/bridge/windowLifecycle';
import { WindowCloseDialog } from './WindowCloseDialog';

vi.mock('../../lib/bridge/windowLifecycle', () => ({
  cancelWindowClose: vi.fn(),
  resolveWindowClose: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(cancelWindowClose).mockReset().mockResolvedValue(undefined);
  vi.mocked(resolveWindowClose).mockReset().mockResolvedValue(undefined);
});
function setup(backgroundAvailable = true) {
  const onResolved = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <WindowCloseDialog backgroundAvailable={backgroundAvailable} onResolved={onResolved} />
    </I18nProvider>,
  );
  return onResolved;
}
it('初次无默认行为且不勾选记住，选择后台只应用本次', async () => {
  const resolved = setup();
  expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
  expect(screen.getByRole('button', { name: '确认选择' })).toBeDisabled();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: /后台运行/ }));
  fireEvent.click(screen.getByRole('button', { name: '后台运行' }));
  await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
  expect(resolveWindowClose).toHaveBeenCalledWith('background', false);
});
it('选择退出与记住后传递默认行为，忙时禁用且不重复提交', async () => {
  let finish: () => void = () => {};
  vi.mocked(resolveWindowClose).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const resolved = setup();
  fireEvent.click(screen.getByRole('radio', { name: /退出应用/ }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '退出应用' }));
  expect(screen.getByRole('button', { name: '正在处理…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(cancelWindowClose).not.toHaveBeenCalled();
  expect(resolveWindowClose).toHaveBeenCalledExactlyOnceWith('quit', true);
  finish();
  await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
});
it.each(['cancel', 'escape', 'dismiss'])('%s 保留窗口且不写偏好', async (method) => {
  const resolved = setup();
  if (method === 'cancel') fireEvent.click(screen.getByRole('button', { name: '取消' }));
  else if (method === 'dismiss') fireEvent.click(screen.getByRole('button', { name: '取消关闭' }));
  else fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
  expect(cancelWindowClose).toHaveBeenCalledOnce();
  expect(resolveWindowClose).not.toHaveBeenCalled();
});
it('失败仍显示弹窗和安全错误，可以取消记住后重试', async () => {
  vi.mocked(resolveWindowClose).mockRejectedValueOnce(new Error('private-token-path'));
  const resolved = setup();
  fireEvent.click(screen.getByRole('radio', { name: /退出应用/ }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '退出应用' }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private-token-path');
  expect(resolved).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '退出应用' }));
  await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
  expect(resolveWindowClose).toHaveBeenLastCalledWith('quit', false);
});
it('无托盘支持时不提供无法恢复的后台行为', () => {
  setup(false);
  expect(screen.getByRole('radio', { name: /后台运行/ })).toBeDisabled();
  expect(screen.getByText(/当前平台暂未提供可恢复的系统托盘/)).toBeVisible();
});
