import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import {
  getWindowCloseState,
  setCloseMode,
  subscribeWindowClose,
} from '../../lib/bridge/windowLifecycle';
import { SettingsCloseBehavior } from './SettingsCloseBehavior';
vi.mock('../../lib/bridge/window', () => ({ supportsWindowControls: () => true }));
vi.mock('../../lib/bridge/windowLifecycle', () => ({
  getWindowCloseState: vi.fn(),
  setCloseMode: vi.fn(),
  subscribeWindowClose: vi.fn(),
  isCloseMode: (mode: string) => ['ask', 'quit', 'background'].includes(mode),
}));
beforeEach(() => {
  vi.mocked(getWindowCloseState)
    .mockReset()
    .mockResolvedValue({ mode: 'ask', pending: false, backgroundAvailable: true });
  vi.mocked(setCloseMode).mockReset().mockResolvedValue(undefined);
  vi.mocked(subscribeWindowClose).mockReturnValue(vi.fn());
});
function setup() {
  return render(
    <I18nProvider initialLocale="zh-CN">
      <SettingsCloseBehavior />
    </I18nProvider>,
  );
}
it('设置页读取真实偏好并保存选择，支持改回每次询问', async () => {
  setup();
  const group = screen.getByRole('radiogroup', { name: '关闭主窗口时' });
  const ask = screen.getByRole('radio', { name: '每次询问' });
  const background = screen.getByRole('radio', { name: '后台运行' });
  await waitFor(() => expect(ask).toBeEnabled());
  expect(ask).toBeChecked();
  expect(group).toHaveAccessibleDescription('选择退出应用，或保留在系统托盘中继续运行。');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  vi.mocked(getWindowCloseState).mockResolvedValue({
    mode: 'background',
    pending: false,
    backgroundAvailable: true,
  });
  fireEvent.click(background);
  await waitFor(() => expect(background).toBeChecked());
  expect(setCloseMode).toHaveBeenLastCalledWith('background');
  vi.mocked(getWindowCloseState).mockResolvedValue({
    mode: 'ask',
    pending: false,
    backgroundAvailable: true,
  });
  fireEvent.click(ask);
  await waitFor(() => expect(ask).toBeChecked());
});
it('保存失败不会假装已更新，并提供安全反馈', async () => {
  setup();
  const ask = screen.getByRole('radio', { name: '每次询问' });
  await waitFor(() => expect(ask).toBeEnabled());
  vi.mocked(setCloseMode).mockRejectedValueOnce(new Error('private-marker'));
  fireEvent.click(screen.getByRole('radio', { name: '退出应用' }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private-marker');
  expect(ask).toBeChecked();
});
it('读取失败可重试，卸载取消读取并清理原生事件订阅', async () => {
  vi.mocked(getWindowCloseState).mockRejectedValueOnce(new Error('private-marker'));
  const view = setup();
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private-marker');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: '每次询问' })).toBeEnabled());
  const signal = vi.mocked(getWindowCloseState).mock.calls.at(-1)?.[0];
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
it('无后台支持时只禁用后台项，方向键跳过它并保存有效选择', async () => {
  vi.mocked(getWindowCloseState).mockResolvedValue({
    mode: 'ask',
    pending: false,
    backgroundAvailable: false,
  });
  setup();
  const ask = screen.getByRole('radio', { name: '每次询问' });
  const quit = screen.getByRole('radio', { name: '退出应用' });
  await waitFor(() => expect(ask).toBeEnabled());
  expect(screen.getByRole('radio', { name: '后台运行' })).toBeDisabled();
  vi.mocked(getWindowCloseState).mockResolvedValue({
    mode: 'quit',
    pending: false,
    backgroundAvailable: false,
  });
  ask.focus();
  fireEvent.keyDown(ask, { key: 'End' });
  expect(quit).toHaveFocus();
  await waitFor(() => expect(quit).toBeChecked());
  expect(setCloseMode).toHaveBeenCalledExactlyOnceWith('quit');
});
it('读取中、保存中和待关闭确认时禁用，未知值不冒充已保存的询问', async () => {
  let finish: (value: {
    mode: 'ask';
    pending: boolean;
    backgroundAvailable: boolean;
  }) => void = () => {};
  vi.mocked(getWindowCloseState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  setup();
  for (const radio of screen.getAllByRole('radio')) {
    expect(radio).toBeDisabled();
    expect(radio).not.toBeChecked();
  }
  finish({ mode: 'ask', pending: false, backgroundAvailable: true });
  await waitFor(() => expect(screen.getByRole('radio', { name: '每次询问' })).toBeEnabled());
  vi.mocked(setCloseMode).mockReturnValue(new Promise(() => {}));
  fireEvent.click(screen.getByRole('radio', { name: '后台运行' }));
  for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  expect(screen.getByRole('radio', { name: '每次询问' })).toBeChecked();
  expect(setCloseMode).toHaveBeenCalledOnce();
});
it('待确认请求不允许从设置改默认值', async () => {
  vi.mocked(getWindowCloseState).mockResolvedValue({
    mode: 'ask',
    pending: true,
    backgroundAvailable: true,
  });
  setup();
  await waitFor(() => expect(screen.getByRole('radio', { name: '每次询问' })).toBeChecked());
  for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  expect(setCloseMode).not.toHaveBeenCalled();
});
