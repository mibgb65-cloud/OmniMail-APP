import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../lib/i18n/I18nProvider';
import { useTheme } from '../lib/theme/useTheme';
import { WorkspaceSidebar, type MailFolder } from './WorkspaceSidebar';

function SidebarPreview() {
  const { theme, toggleTheme } = useTheme();
  const [folder, setFolder] = useState<MailFolder>('inbox');
  return (
    <WorkspaceSidebar
      theme={theme}
      onToggleTheme={toggleTheme}
      selectedFolder={folder}
      onSelectFolder={setFolder}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('侧栏底部设置入口', () => {
  it('复用一个背景滑块，并在选择及布局变化后重新定位', () => {
    const folders = ['inbox', 'starred', 'sent', 'drafts', 'archive', 'deleted'];
    let rowHeight = 36;
    let notifyResize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.tagName === 'NAV') return new DOMRect(20, 100, 180, 300);
      const index = folders.indexOf(this.dataset.folder ?? '');
      return index < 0
        ? new DOMRect()
        : new DOMRect(20, 104 + index * (rowHeight + 4), 180, rowHeight);
    });
    const view = render(
      <I18nProvider initialLocale="zh-CN">
        <SidebarPreview />
      </I18nProvider>,
    );
    const navigation = screen.getByRole('navigation');
    const indicator = navigation.querySelector(':scope > div[aria-hidden="true"]');
    expect(indicator).toHaveStyle({ transform: 'translateY(4px)', height: '36px' });
    fireEvent.click(within(navigation).getByRole('button', { name: '已删除邮件' }));
    expect(navigation.querySelector(':scope > div[aria-hidden="true"]')).toBe(indicator);
    expect(indicator).toHaveStyle({ transform: 'translateY(204px)', height: '36px' });
    rowHeight = 42;
    notifyResize();
    expect(indicator).toHaveStyle({ transform: 'translateY(234px)', height: '42px' });
    rowHeight = 40;
    fireEvent(window, new Event('resize'));
    expect(indicator).toHaveStyle({ transform: 'translateY(224px)', height: '40px' });
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it.each([
    ['zh-CN', '写邮件', '待开发'],
    ['en', 'Compose', 'Planned'],
  ] as const)('%s 在应用名称下方、导航上方提供撰写入口', (locale, compose, pending) => {
    render(
      <I18nProvider initialLocale={locale}>
        <SidebarPreview />
      </I18nProvider>,
    );
    const brand = screen.getByText('OmniMail');
    const button = screen.getByRole('button', { name: compose });
    const navigation = screen.getByRole('navigation');
    expect(button).toBeVisible();
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(pending);
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(brand.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      button.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it.each([
    ['zh-CN', '设置', '全部收件箱', '已删除邮件', '桌面端'],
    ['en', 'Settings', 'All inboxes', 'Deleted', 'DESKTOP'],
  ] as const)(
    '%s 只在导航下方保留一个设置按钮',
    (locale, settings, inbox, accounts, desktopLabel) => {
      render(
        <I18nProvider initialLocale={locale}>
          <SidebarPreview />
        </I18nProvider>,
      );
      const navigation = screen.getByRole('navigation');
      const button = screen.getByRole('button', { name: settings });
      expect(button).toBeVisible();
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByText('OmniMail')).toBeVisible();
      expect(screen.queryByText(desktopLabel)).not.toBeInTheDocument();
      expect(screen.getAllByText(settings)).toHaveLength(1);
      expect(within(navigation).queryByText(settings)).not.toBeInTheDocument();
      expect(within(navigation).getByText(inbox)).toBeVisible();
      expect(within(navigation).getByText(accounts)).toBeVisible();
      expect(
        navigation.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    },
  );

  it.each([
    ['zh-CN', ['全部收件箱', '星标邮件', '已发送邮件', '草稿箱', '归档邮件', '已删除邮件']],
    ['en', ['All inboxes', 'Starred', 'Sent', 'Drafts', 'Archive', 'Deleted']],
  ] as const)('%s 按顺序展示邮件分类并切换前端选择', (locale, labels) => {
    render(
      <I18nProvider initialLocale={locale}>
        <SidebarPreview />
      </I18nProvider>,
    );
    const buttons = within(screen.getByRole('navigation')).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(labels);
    for (const button of buttons) {
      expect(button).toBeEnabled();
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    const first = within(screen.getByRole('navigation')).getByRole('button', { name: labels[0] });
    const second = within(screen.getByRole('navigation')).getByRole('button', { name: labels[1] });
    const secondIcon = second.querySelector('svg');
    expect(first).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(second);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(second.querySelector('svg')).toBe(secondIcon);
  });

  it.each([
    [
      'zh-CN',
      '我的邮箱',
      '尚未添加邮箱',
      '添加邮箱',
      '待开发',
      '邮箱账号接入尚未实现，当前仅展示界面。',
    ],
    [
      'en',
      'My mailboxes',
      'No mailbox added yet',
      'Add mailbox',
      'Planned',
      'Mailbox connection is not available yet; UI preview only.',
    ],
  ] as const)(
    '%s 在邮件分类下方展示我的邮箱分组，入口保持禁用',
    (locale, label, empty, addMailbox, pending, unavailable) => {
      render(
        <I18nProvider initialLocale={locale}>
          <SidebarPreview />
        </I18nProvider>,
      );
      const navigation = screen.getByRole('navigation');
      const region = screen.getByRole('region', { name: label });
      expect(region).toBeVisible();
      expect(within(navigation).queryByText(label)).not.toBeInTheDocument();
      expect(within(region).getByText(empty)).toBeVisible();
      const button = within(region).getByRole('button', { name: addMailbox });
      expect(button).toBeVisible();
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(pending);
      expect(button).toHaveAttribute('title', unavailable);
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(
        navigation.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    },
  );

  it('移除原有底部说明和隐私图标区域', () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <SidebarPreview />
      </I18nProvider>,
    );
    for (const text of ['本地优先，保持专注', '邮件留在你的设备上。', '当前为工程初始化版本。']) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '设置' }).querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('设置按钮能打开弹窗，关闭后仍可再次打开', async () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <SidebarPreview />
      </I18nProvider>,
    );
    const button = screen.getByRole('button', { name: '设置' });
    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: '设置' })).toHaveAttribute('open');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('消息和设置入口位于同一区域，切换到设置会关闭消息卡片', () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <SidebarPreview />
      </I18nProvider>,
    );
    const settings = screen.getByRole('button', { name: '设置' });
    const messages = screen.getByRole('button', { name: '消息' });
    expect(settings.parentElement).toContainElement(messages);
    fireEvent.click(messages);
    expect(screen.getByRole('dialog', { name: '消息' })).toBeVisible();
    fireEvent.pointerDown(settings);
    fireEvent.click(settings);
    expect(screen.queryByRole('dialog', { name: '消息' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '设置' })).toHaveAttribute('open');
  });
});
