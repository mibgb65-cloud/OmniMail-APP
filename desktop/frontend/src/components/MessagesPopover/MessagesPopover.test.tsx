import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../lib/i18n/I18nProvider';
import type { Locale } from '../../lib/i18n/resources';
import { MessagesPopover } from './MessagesPopover';

function renderMessages(locale: Locale = 'zh-CN') {
  return render(
    <StrictMode>
      <I18nProvider initialLocale={locale}>
        <MessagesPopover />
      </I18nProvider>
    </StrictMode>,
  );
}

describe('消息按钮与空态卡片', () => {
  it('只展示铃铛按钮，不伪造未读数；点击后显示消息空态', () => {
    renderMessages();
    const button = screen.getByRole('button', { name: '消息' });
    expect(button.textContent).toBe('');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(button, escape);
    expect(escape.defaultPrevented).toBe(false);
    fireEvent.click(button);
    const panel = screen.getByRole('dialog', { name: '消息' });
    expect(panel).toHaveAttribute('aria-modal', 'false');
    expect(panel).toHaveFocus();
    expect(screen.getByText('暂无新消息')).toBeVisible();
    expect(panel).toHaveAccessibleDescription('新的应用通知会显示在这里。');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it.each(['escape', 'close'])('通过 %s 关闭并恢复按钮焦点', (method) => {
    renderMessages();
    const trigger = screen.getByRole('button', { name: '消息' });
    fireEvent.click(trigger);
    if (method === 'escape') fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    else fireEvent.click(screen.getByRole('button', { name: '关闭消息' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each(['pointer', 'focus', 'blur', 'resize', 'toggle'])('通过 %s 收起卡片', (method) => {
    renderMessages();
    const trigger = screen.getByRole('button', { name: '消息' });
    fireEvent.click(trigger);
    if (method === 'pointer') fireEvent.pointerDown(document.body);
    else if (method === 'focus') fireEvent.focusIn(document.body);
    else if (method === 'blur') fireEvent.blur(window);
    else if (method === 'resize') fireEvent.resize(window);
    else fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('卡片内部点击不会关闭，英语文案正常显示', () => {
    renderMessages('en');
    fireEvent.click(screen.getByRole('button', { name: 'Messages' }));
    fireEvent.pointerDown(screen.getByText('No new messages'));
    fireEvent.click(screen.getByText('No new messages'));
    expect(screen.getByRole('dialog', { name: 'Messages' })).toBeVisible();
    expect(screen.getByText('New app notifications will appear here.')).toBeVisible();
  });

  it('卸载时清理外部监听', () => {
    const view = renderMessages();
    fireEvent.click(screen.getByRole('button', { name: '消息' }));
    const remove = vi.spyOn(document, 'removeEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    view.unmount();
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(remove).toHaveBeenCalledWith('focusin', expect.any(Function), true);
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    remove.mockRestore();
    removeWindow.mockRestore();
  });
});
