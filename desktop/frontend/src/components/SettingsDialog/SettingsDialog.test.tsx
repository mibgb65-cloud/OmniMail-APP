import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../lib/i18n/I18nProvider';
import type { VersionInfo } from '../../lib/bridge/app';
import { THEME_STORAGE_KEY } from '../../lib/theme/theme';
import { useTheme } from '../../lib/theme/useTheme';
import { VERSION_INFO } from '../../test/fixtures';
import { SettingsDialog } from './SettingsDialog';
import { getStorageUsage } from '../../lib/bridge/storage';

vi.mock('../../lib/bridge/storage', () => ({ getStorageUsage: vi.fn() }));

function DialogPreview({
  onClose,
  versionInfo,
}: {
  onClose: () => void;
  versionInfo?: VersionInfo;
}) {
  const { themePreference, selectTheme } = useTheme();
  return (
    <SettingsDialog
      themePreference={themePreference}
      onThemePreferenceChange={selectTheme}
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
  vi.mocked(getStorageUsage).mockResolvedValue({
    totalBytes: 1024,
    mailDataBytes: 512,
    attachmentsBytes: 256,
    logsBytes: 128,
    backupsBytes: 128,
    otherBytes: 0,
  });
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('设置模态悬浮窗', () => {
  it('邮件查看提供正文跟随暗色开关，保存后重开仍保持选择', () => {
    const view = renderDialog();
    fireEvent.click(screen.getByRole('tab', { name: '邮件查看' }));
    const toggle = screen.getByRole('switch', { name: '邮件正文跟随暗色模式' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('tab', { name: '通用设置' }));
    expect(screen.getByRole('radio', { name: '跟随系统' })).toBeChecked();
    view.unmount();
    renderDialog();
    fireEvent.click(screen.getByRole('tab', { name: '邮件查看' }));
    expect(screen.getByRole('switch', { name: '邮件正文跟随暗色模式' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('邮件配色保存失败时本会话生效、提示未保存且不泄露底层错误', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('tab', { name: '邮件查看' }));
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private-marker');
    });
    fireEvent.click(screen.getByRole('switch', { name: '邮件正文跟随暗色模式' }));
    expect(screen.getByRole('switch', { name: '邮件正文跟随暗色模式' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('当前无法保存偏好');
    expect(screen.getByRole('alert')).not.toHaveTextContent('private-marker');
    blocked.mockRestore();
    fireEvent.click(screen.getByRole('switch', { name: '邮件正文跟随暗色模式' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('英文设置提供可访问名称和说明', () => {
    render(
      <I18nProvider initialLocale="en">
        <DialogPreview onClose={vi.fn()} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Mail viewing' }));
    expect(
      screen.getByRole('switch', { name: 'Email body follows dark mode' }),
    ).toHaveAccessibleDescription(/HTML email bodies adapt/);
  });
  it('挂载后进入原生模态状态，提供名称和说明', () => {
    const { dialog } = renderDialog();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('选择左侧分类，查看和调整对应设置。');
    expect(screen.getByRole('radio', { name: '跟随系统' })).toBeChecked();
  });

  it.each(['close', 'escape'])('通过 %s 关闭', async (method) => {
    const { dialog, onClose } = renderDialog();
    if (method === 'escape') {
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));
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
    const themeChoice = screen.getByRole('radio', { name: '暗色模式' });
    fireEvent.click(themeChoice);
    expect(screen.getByRole('radio', { name: '暗色模式' })).toBe(themeChoice);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    fireEvent.click(within(dialog).getByRole('button', { name: 'English' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBe(dialog);
    expect(screen.getByRole('radio', { name: 'Dark mode' })).toBeChecked();
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
    expect(screen.queryByRole('button', { name: '完成' })).not.toBeInTheDocument();
    expect(screen.queryByText('更改即时生效')).not.toBeInTheDocument();
    const first = screen.getByRole('tab', { name: '通用设置' });
    const last = screen.getByRole('radio', { name: '跟随系统' });
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
    const accounts = screen.getByRole('tab', { name: '邮箱设置' });
    const updates = screen.getByRole('tab', { name: '软件更新' });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '通用设置',
      '邮箱设置',
      '通知设置',
      '邮件查看',
      'AI 设置',
      '存储情况',
      '关于',
      '软件更新',
    ]);
    general.focus();
    fireEvent.keyDown(general, { key: 'ArrowDown' });
    expect(accounts).toHaveFocus();
    fireEvent.keyDown(accounts, { key: 'End' });
    expect(updates).toHaveFocus();
    fireEvent.keyDown(updates, { key: 'ArrowDown' });
    expect(general).toHaveFocus();
    fireEvent.keyDown(general, { key: 'ArrowUp' });
    expect(updates).toHaveFocus();
    const panel = screen.getByRole('tabpanel', { name: '软件更新' });
    panel.focus();
    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(updates).toHaveFocus();
    fireEvent.keyDown(updates, { key: 'Home' });
    expect(general).toHaveFocus();
  });

  it('存储情况按后端实际字节数展示，不再显示示例数据', async () => {
    const { dialog, onClose } = renderDialog();
    const general = screen.getByRole('tabpanel', { name: '通用设置' });
    fireEvent.click(screen.getByRole('tab', { name: '存储情况' }));
    const panel = screen.getByRole('tabpanel', { name: '存储情况' });
    expect(within(dialog).getByRole('heading', { level: 2, name: '存储情况' })).toBeVisible();
    expect(panel).toBeVisible();
    expect(general).not.toBeVisible();
    expect(screen.getByRole('tab', { name: '存储情况' })).toHaveAttribute('aria-selected', 'true');

    const card = within(panel).getByRole('region', { name: '存储情况' });
    expect(await within(card).findByText('1.00 KB')).toBeVisible();
    expect(within(card).queryByText('界面预览 · 示例数据')).not.toBeInTheDocument();
    expect(within(card).getByText('已用空间')).toBeVisible();
    expect(
      within(card).getByRole('img', {
        name: '存储占用：邮件数据 50.0%，附件缓存 25.0%，运行日志 12.5%，数据库备份 12.5%，其他文件 0.0%',
      }),
    ).toBeVisible();

    const rows = within(card).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('512 B50.0%');
    expect(within(card).getByText(/全文索引已包含在邮件数据中/)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('切换分类时面板互斥显示，存储面板在再次切回后仍保留', async () => {
    renderDialog();
    const storageTab = screen.getByRole('tab', { name: '存储情况' });
    fireEvent.click(storageTab);
    const storage = screen.getByRole('tabpanel', { name: '存储情况' });
    await within(storage).findByText('1.00 KB');
    fireEvent.click(screen.getByRole('tab', { name: '关于' }));
    expect(storage).not.toBeVisible();
    expect(screen.getByRole('tabpanel', { name: '关于' })).toBeVisible();
    fireEvent.click(storageTab);
    await within(storage).findByText('1.00 KB');
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
