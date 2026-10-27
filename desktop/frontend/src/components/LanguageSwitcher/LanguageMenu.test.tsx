import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { LOCALE_STORAGE_KEY } from '../../lib/i18n/locale';
import { LanguageMenu } from './LanguageMenu';

function renderMenu() {
  return render(
    <StrictMode>
      <I18nProvider initialLocale="zh-CN">
        <LanguageMenu />
      </I18nProvider>
    </StrictMode>,
  );
}

beforeEach(() => window.localStorage.clear());

describe('纯图标语言菜单', () => {
  it('收起时只显示图标，不显示语言文字或原生选择框', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: '切换语言' });
    expect(trigger).toHaveTextContent('');
    expect(trigger.textContent).toBe('');
    expect(trigger.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('点击展开，标记当前语言；选择后保存、收起并恢复焦点', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: '切换语言' }));
    expect(screen.getByRole('menu', { name: '界面语言' })).toBeVisible();
    expect(screen.getByRole('menuitemradio', { name: '简体中文' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change language' })).toHaveFocus();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(screen.getByRole('menuitemradio', { name: '简体中文' }));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN');
  });

  it('支持方向键、Home/End 和指针焦点导航', () => {
    renderMenu();
    fireEvent.keyDown(screen.getByRole('button', { name: '切换语言' }), { key: 'ArrowUp' });
    const chinese = screen.getByRole('menuitemradio', { name: '简体中文' });
    const english = screen.getByRole('menuitemradio', { name: 'English' });
    expect(english).toHaveFocus();
    fireEvent.keyDown(english, { key: 'Home' });
    expect(chinese).toHaveFocus();
    fireEvent.keyDown(chinese, { key: 'ArrowUp' });
    expect(english).toHaveFocus();
    fireEvent.keyDown(english, { key: 'ArrowDown' });
    expect(chinese).toHaveFocus();
    fireEvent.keyDown(chinese, { key: 'End' });
    expect(english).toHaveFocus();
    fireEvent.pointerMove(chinese);
    expect(chinese).toHaveFocus();
    fireEvent.keyDown(chinese, { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('button', { name: '切换语言' }), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: '简体中文' })).toHaveFocus();
  });

  it('Esc 只关闭菜单，不传播给后方开屏', () => {
    renderMenu();
    const onEscape = vi.fn();
    window.addEventListener('keydown', onEscape);
    fireEvent.click(screen.getByRole('button', { name: '切换语言' }));
    fireEvent.keyDown(screen.getByRole('menuitemradio', { name: '简体中文' }), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '切换语言' })).toHaveFocus();
    expect(onEscape).not.toHaveBeenCalled();
    window.removeEventListener('keydown', onEscape);
  });

  it.each(['pointer', 'focus', 'scroll', 'blur', 'resize', 'toggle', 'tab'])(
    '通过 %s 收起菜单',
    (method) => {
      renderMenu();
      const trigger = screen.getByRole('button', { name: '切换语言' });
      fireEvent.click(trigger);
      if (method === 'pointer') fireEvent.pointerDown(document.body);
      else if (method === 'focus') fireEvent.focusIn(document.body);
      else if (method === 'scroll') {
        vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 40, 40));
        fireEvent.scroll(document.body);
      } else if (method === 'blur') fireEvent.blur(window);
      else if (method === 'resize') fireEvent.resize(window);
      else if (method === 'toggle') fireEvent.click(trigger);
      else
        fireEvent.keyDown(screen.getByRole('menuitemradio', { name: '简体中文' }), { key: 'Tab' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    },
  );

  it('卸载后清理外部事件监听', () => {
    const view = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: '切换语言' }));
    const remove = vi.spyOn(document, 'removeEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    view.unmount();
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(remove).toHaveBeenCalledWith('focusin', expect.any(Function), true);
    expect(removeWindow).toHaveBeenCalledWith('blur', expect.any(Function));
    remove.mockRestore();
    removeWindow.mockRestore();
  });

  it('晚到的滚动事件未移动按钮时，不应误关刚打开的菜单', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: '切换语言' }));
    fireEvent.scroll(document.body);
    expect(screen.getByRole('menu')).toBeVisible();
  });
});
