import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as windowBridge from '../../lib/bridge/window';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import type { Locale } from '../../lib/i18n/resources';
import { THEME_STORAGE_KEY } from '../../lib/theme/theme';
import { useTheme } from '../../lib/theme/useTheme';
import { TitleBar } from './TitleBar';

vi.mock('../../lib/bridge/window', () => ({
  supportsWindowControls: vi.fn(),
  readWindowMaximised: vi.fn(),
  performWindowAction: vi.fn(),
  subscribeWindowState: vi.fn(),
}));

const unsubscribe = vi.fn();
let windowChanged: () => void;

function TitleBarPreview({
  folderTitle,
  startupVisible,
}: {
  folderTitle?: string;
  startupVisible?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  return (
    <TitleBar
      theme={theme}
      onToggleTheme={toggleTheme}
      folderTitle={folderTitle}
      startupVisible={startupVisible}
    />
  );
}

function renderTitleBar(locale: Locale = 'zh-CN') {
  return render(
    <I18nProvider initialLocale={locale}>
      <TitleBarPreview />
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  vi.mocked(windowBridge.supportsWindowControls).mockReturnValue(true);
  vi.mocked(windowBridge.readWindowMaximised).mockResolvedValue(false);
  vi.mocked(windowBridge.performWindowAction).mockResolvedValue(undefined);
  vi.mocked(windowBridge.subscribeWindowState).mockImplementation((callback) => {
    windowChanged = callback;
    return unsubscribe;
  });
});
afterEach(() => {
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

describe('自绘窗口操作栏', () => {
  it.each([
    ['zh-CN', '邮件状态', '同步时间', '未同步', '未读邮件'],
    ['en', 'Mail status', 'Last sync', 'Not synced', 'Unread'],
  ] as const)(
    '%s 在分类后显示两个只读状态气泡，开屏时隐藏',
    (locale, label, sync, value, unread) => {
      const view = render(
        <I18nProvider initialLocale={locale}>
          <TitleBarPreview folderTitle="Starred" />
        </I18nProvider>,
      );
      const status = screen.getByLabelText(label);
      expect(status.previousElementSibling).toHaveAccessibleName('Starred');
      expect(within(status).getByText(sync)).toBeVisible();
      expect(within(status).getByText(value)).toBeVisible();
      expect(within(status).getByText(unread)).toBeVisible();
      expect(within(status).getByText('—')).toBeVisible();
      expect(within(status).getAllByRole('definition')).toHaveLength(2);
      expect(within(status).queryByRole('button')).not.toBeInTheDocument();
      view.rerender(
        <I18nProvider initialLocale={locale}>
          <TitleBarPreview folderTitle="Starred" startupVisible />
        </I18nProvider>,
      );
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(3);
    },
  );

  it('不再重复展示应用图标、品牌名称和开发预览文案', () => {
    renderTitleBar();
    const toolbar = screen.getByRole('banner', { name: '窗口操作栏' });
    expect(within(toolbar).queryByText('OmniMail')).not.toBeInTheDocument();
    expect(within(toolbar).queryByText('开发预览')).not.toBeInTheDocument();
    expect(toolbar.querySelector('img')).toBeNull();
  });

  it('语言与主题操作位于控制栏中，可切换并持久化', () => {
    renderTitleBar();
    const toolbar = screen.getByRole('banner', { name: '窗口操作栏' });
    expect(within(toolbar).getByRole('group', { name: '切换语言' })).toBeVisible();
    expect(within(toolbar).queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(within(toolbar).getByRole('button', { name: '深色模式' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: '深色模式' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(toolbar).getByRole('button', { name: 'English' }));
    expect(screen.getByRole('banner', { name: 'Window toolbar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close window' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('最小化、最大化、还原与关闭调用真实适配入口', async () => {
    renderTitleBar();
    fireEvent.click(screen.getByRole('button', { name: '最小化' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '最大化' })).toBeEnabled());
    expect(windowBridge.performWindowAction).toHaveBeenLastCalledWith('minimize');
    vi.mocked(windowBridge.readWindowMaximised).mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: '最大化' }));
    await screen.findByRole('button', { name: '还原窗口' });
    expect(windowBridge.performWindowAction).toHaveBeenLastCalledWith('maximize');
    vi.mocked(windowBridge.readWindowMaximised).mockResolvedValue(false);
    await waitFor(() => expect(screen.getByRole('button', { name: '还原窗口' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '还原窗口' }));
    await screen.findByRole('button', { name: '最大化' });
    await waitFor(() => expect(screen.getByRole('button', { name: '关闭窗口' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '关闭窗口' }));
    expect(windowBridge.performWindowAction).toHaveBeenLastCalledWith('close');
  });

  it('双击标题区域切换最大化，系统窗口事件也会更新按钮', async () => {
    const view = renderTitleBar();
    const dragRegion = view.container.querySelector('[data-window-drag]');
    if (!dragRegion) throw new Error('缺少窗口拖动区域');
    fireEvent.doubleClick(dragRegion);
    expect(windowBridge.performWindowAction).toHaveBeenCalledWith('maximize');
    vi.mocked(windowBridge.readWindowMaximised).mockResolvedValue(true);
    act(() => windowChanged());
    await screen.findByRole('button', { name: '还原窗口' });
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('同一操作未结束时不重复发送窗口命令', async () => {
    let finish: (() => void) | undefined;
    vi.mocked(windowBridge.performWindowAction).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderTitleBar();
    const minimize = screen.getByRole('button', { name: '最小化' });
    fireEvent.click(minimize);
    fireEvent.click(minimize);
    expect(minimize).toBeDisabled();
    expect(windowBridge.performWindowAction).toHaveBeenCalledOnce();
    await act(async () => finish?.());
    expect(minimize).toBeEnabled();
  });

  it('操作失败提供安全提示并允许重试，不显示原始错误', async () => {
    vi.mocked(windowBridge.performWindowAction).mockRejectedValueOnce(new Error('token=private'));
    renderTitleBar();
    fireEvent.click(screen.getByRole('button', { name: '最小化' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('窗口操作未完成，请重试。');
    expect(screen.queryByText(/private/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '最小化' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('浏览器预览仅禁用窗口操作，不影响语言和主题', () => {
    vi.mocked(windowBridge.supportsWindowControls).mockReturnValue(false);
    renderTitleBar();
    for (const name of ['最小化', '最大化', '关闭窗口']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: '深色模式' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '简体中文' })).toBeEnabled();
    expect(windowBridge.readWindowMaximised).not.toHaveBeenCalled();
  });

  it('状态读取失败可见，但 StrictMode 中过期请求失败不会覆盖新结果', async () => {
    vi.mocked(windowBridge.readWindowMaximised).mockRejectedValueOnce(new Error('private'));
    const view = renderTitleBar();
    expect(await screen.findByRole('alert')).toHaveTextContent('窗口操作未完成');
    view.unmount();
    let rejectOld: ((reason: Error) => void) | undefined;
    vi.mocked(windowBridge.readWindowMaximised).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectOld = reject;
      }),
    );
    render(
      <StrictMode>
        <I18nProvider initialLocale="zh-CN">
          <TitleBarPreview />
        </I18nProvider>
      </StrictMode>,
    );
    await act(async () => rejectOld?.(new Error('private')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
