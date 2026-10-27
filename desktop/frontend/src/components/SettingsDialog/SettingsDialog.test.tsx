import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../lib/i18n/I18nProvider';
import type { VersionInfo } from '../../lib/bridge/app';
import { THEME_STORAGE_KEY } from '../../lib/theme/theme';
import { useTheme } from '../../lib/theme/useTheme';
import { VERSION_INFO } from '../../test/fixtures';
import { SettingsDialog } from './SettingsDialog';

function DialogPreview({
  onClose,
  versionInfo,
}: {
  onClose: () => void;
  versionInfo?: VersionInfo;
}) {
  const { theme, toggleTheme } = useTheme();
  return (
    <SettingsDialog
      theme={theme}
      onToggleTheme={toggleTheme}
      onClose={onClose}
      versionInfo={versionInfo}
    />
  );
}

function renderDialog(versionInfo?: VersionInfo) {
  const onClose = vi.fn();
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <DialogPreview onClose={onClose} versionInfo={versionInfo} />
    </I18nProvider>,
  );
  return { ...view, onClose, dialog: screen.getByRole('dialog', { name: '设置' }) };
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('设置模态悬浮窗', () => {
  it('挂载后进入原生模态状态，提供名称和说明', () => {
    const { dialog } = renderDialog();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('选择左侧分类，查看和调整对应设置。');
    expect(screen.getByRole('switch', { name: '深色模式' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it.each(['close', 'done', 'escape'])('通过 %s 关闭', async (method) => {
    const { dialog, onClose } = renderDialog();
    if (method === 'escape') {
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
    } else {
      fireEvent.click(
        screen.getByRole('button', { name: method === 'done' ? '完成' : '关闭设置' }),
      );
    }
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(dialog).not.toHaveAttribute('open');
  });

  it('点击遮罩关闭，但内容点击与跨边界拖动不会误关闭', async () => {
    const { dialog, onClose } = renderDialog();
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 500, 400));
    fireEvent.pointerDown(dialog, { clientX: 120, clientY: 120 });
    fireEvent.click(dialog, { clientX: 120, clientY: 120 });
    fireEvent.pointerDown(dialog, { clientX: 120, clientY: 120 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(dialog).toHaveAttribute('open');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog, { clientX: 20, clientY: 20 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('主题与语言更改立即生效，且不重建或关闭模态窗', () => {
    const { dialog, onClose } = renderDialog();
    const themeSwitch = screen.getByRole('switch', { name: '深色模式' });
    const themeIcon = themeSwitch.querySelector('svg');
    expect(themeIcon).toBeInTheDocument();
    fireEvent.click(themeSwitch);
    expect(themeSwitch.querySelector('svg')).toBe(themeIcon);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: '界面语言' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBe(dialog);
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Close settings' })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('StrictMode 的过期关闭通知不会误关新打开的弹窗', async () => {
    const onClose = vi.fn();
    render(
      <StrictMode>
        <I18nProvider initialLocale="zh-CN">
          <DialogPreview onClose={onClose} />
        </I18nProvider>
      </StrictMode>,
    );
    await act(async () => {});
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Tab 与 Shift+Tab 在首尾控件之间循环，不丢失焦点', () => {
    renderDialog();
    const first = screen.getByRole('tab', { name: '通用设置' });
    const last = screen.getByRole('button', { name: '完成' });
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    const shortcut = new KeyboardEvent('keydown', {
      key: 'Tab',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(first, shortcut);
    expect(shortcut.defaultPrevented).toBe(false);
  });

  it('卸载时关闭原生模态层，释放背景交互', async () => {
    const { dialog, onClose, unmount } = renderDialog();
    unmount();
    await act(async () => {});
    expect(dialog).not.toHaveAttribute('open');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('点击左侧分类只切换右侧内容，不重建或关闭弹窗', () => {
    const { dialog, onClose } = renderDialog(VERSION_INFO);
    const general = screen.getByRole('tabpanel', { name: '通用设置' });
    fireEvent.click(screen.getByRole('tab', { name: '关于' }));
    const about = screen.getByRole('tabpanel', { name: '关于' });
    expect(general).not.toBeVisible();
    expect(within(about).getByText(VERSION_INFO.version)).toBeVisible();
    expect(within(about).getByText(VERSION_INFO.platform)).toBeVisible();
    expect(screen.getByRole('tab', { name: '关于' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('dialog', { name: '设置' })).toBe(dialog);
    fireEvent.click(screen.getByRole('tab', { name: '通用设置' }));
    expect(general).toBeVisible();
    expect(about).not.toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('分类列支持上下箭头和 Home/End 键，Tab 循环跟随当前分类', () => {
    renderDialog();
    const general = screen.getByRole('tab', { name: '通用设置' });
    const storage = screen.getByRole('tab', { name: '存储情况' });
    const about = screen.getByRole('tab', { name: '关于' });
    general.focus();
    fireEvent.keyDown(general, { key: 'ArrowDown' });
    expect(storage).toHaveFocus();
    fireEvent.keyDown(storage, { key: 'ArrowDown' });
    expect(about).toHaveFocus();
    fireEvent.keyDown(about, { key: 'ArrowDown' });
    expect(general).toHaveFocus();
    fireEvent.keyDown(general, { key: 'ArrowUp' });
    expect(about).toHaveFocus();
    fireEvent.keyDown(about, { key: 'End' });
    expect(about).toHaveFocus();
    const done = screen.getByRole('button', { name: '完成' });
    done.focus();
    fireEvent.keyDown(done, { key: 'Tab' });
    expect(about).toHaveFocus();
    fireEvent.keyDown(about, { key: 'Home' });
    expect(general).toHaveFocus();
  });

  it('存储情况按存储类型展示占用，并标明示例数据', () => {
    const { dialog, onClose } = renderDialog();
    const general = screen.getByRole('tabpanel', { name: '通用设置' });
    fireEvent.click(screen.getByRole('tab', { name: '存储情况' }));
    const panel = screen.getByRole('tabpanel', { name: '存储情况' });
    expect(within(dialog).getByRole('heading', { level: 2, name: '存储情况' })).toBeVisible();
    expect(panel).toBeVisible();
    expect(general).not.toBeVisible();
    expect(screen.getByRole('tab', { name: '存储情况' })).toHaveAttribute('aria-selected', 'true');

    const card = within(panel).getByRole('region', { name: '存储情况' });
    expect(within(card).getByText('界面预览 · 示例数据')).toBeVisible();
    expect(within(card).getByText('1.20 GB')).toBeVisible();
    expect(within(card).getByText('已用空间')).toBeVisible();
    expect(
      within(card).getByRole('img', {
        name: '存储占用：邮件数据 52.6%，附件缓存 27.3%，全文索引 12.3%，运行日志 7.8%',
      }),
    ).toBeVisible();

    const rows = within(card).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.textContent)).toEqual([
      '邮件数据邮件正文、头信息与本地目录648 MB52.6%',
      '附件缓存已下载的附件与内嵌图片336 MB27.3%',
      '全文索引用于本地搜索的检索索引152 MB12.3%',
      '运行日志诊断日志与崩溃报告96 MB7.8%',
    ]);
    expect(within(card).getByText('存储统计尚未接入，以上为界面演示数据。')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('切换分类时面板互斥显示，存储面板在再次切回后仍保留', () => {
    renderDialog();
    const storageTab = screen.getByRole('tab', { name: '存储情况' });
    fireEvent.click(storageTab);
    const storage = screen.getByRole('tabpanel', { name: '存储情况' });
    fireEvent.click(screen.getByRole('tab', { name: '关于' }));
    expect(storage).not.toBeVisible();
    expect(screen.getByRole('tabpanel', { name: '关于' })).toBeVisible();
    fireEvent.click(storageTab);
    expect(storage).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: '存储情况' })).toBeVisible();
  });

  it('缺少版本连接信息时不伪造数据，未知构建信息使用本地化提示', () => {
    const view = renderDialog();
    fireEvent.click(screen.getByRole('tab', { name: '关于' }));
    expect(screen.getByRole('status')).toHaveTextContent('版本信息暂不可用');
    view.unmount();
    renderDialog({ ...VERSION_INFO, commit: 'unknown', buildTime: 'unknown' });
    fireEvent.click(screen.getByRole('tab', { name: '关于' }));
    expect(screen.getAllByText('未知')).toHaveLength(2);
  });
});
