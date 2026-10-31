import { readFileSync } from 'node:fs';

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { LOCALE_STORAGE_KEY } from '../../lib/i18n/locale';
import { SUPPORTED_LOCALES } from '../../lib/i18n/resources';
import { LanguageSwitcher } from './LanguageSwitcher';

afterEach(() => window.localStorage.clear());

function renderSwitcher(compact = true, locale: (typeof SUPPORTED_LOCALES)[number] = 'zh-CN') {
  return render(
    <I18nProvider initialLocale={locale}>
      <LanguageSwitcher compact={compact} />
    </I18nProvider>,
  );
}

describe('悬停横向展开语言胶囊', () => {
  it('显式隔离全局主按钮 hover 背景，选中高亮只由共享滑块绘制', () => {
    // jsdom 不计算真实 :hover 层叠；保留局部重置契约，实际颜色另由浏览器回归。
    const languageStyles = readFileSync(
      'src/components/LanguageSwitcher/LanguageSwitcher.module.css',
      'utf8',
    );
    expect(languageStyles).toMatch(
      /\.option:hover:not\(:disabled\)\s*\{[^}]*\bbackground:\s*transparent\s*;/,
    );
  });

  it('直接呈现受支持的语言按钮及翻译图标，不再使用下拉框或弹窗触发器', () => {
    const view = renderSwitcher();
    const capsule = screen.getByRole('group', { name: '切换语言' });
    const options = within(capsule).getAllByRole('button');
    expect(options).toHaveLength(SUPPORTED_LOCALES.length);
    expect(options.map((button) => button.lang)).toEqual([...SUPPORTED_LOCALES]);
    expect(within(capsule).getByRole('button', { name: '简体中文' })).toHaveTextContent('简中');
    expect(within(capsule).getByRole('button', { name: 'English' })).toHaveTextContent('EN');
    expect(capsule.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(view.container.querySelector('select')).toBeNull();
    expect(view.container.querySelector('[aria-haspopup], [popover]')).toBeNull();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it.each(SUPPORTED_LOCALES)('正确呈现 %s 初始选中状态、语言与完整标题', (locale) => {
    renderSwitcher(true, locale);
    for (const value of SUPPORTED_LOCALES) {
      const fullLabel = value === 'en' ? 'English' : '简体中文';
      const option = screen.getByRole('button', { name: fullLabel });
      expect(option).toHaveAttribute('aria-pressed', String(value === locale));
      expect(option).toHaveAttribute('data-tooltip', fullLabel);
      expect(option).not.toHaveAttribute('title');
      expect(option).toHaveAttribute('lang', value);
    }
    expect(screen.getByRole('group').querySelector('span[aria-hidden="true"]')).toHaveStyle({
      transform: `translateX(${SUPPORTED_LOCALES.indexOf(locale) * 100}%)`,
    });
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it('复用单个装饰性选中层，连续切换时直接更新滑动目标', () => {
    renderSwitcher();
    const capsule = screen.getByRole('group');
    const indicator = capsule.querySelector('span[aria-hidden="true"]');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveStyle({ transform: 'translateX(0%)' });
    for (const locale of ['en', 'zh-CN', 'en', 'zh-CN'] as const) {
      fireEvent.click(
        within(capsule).getByRole('button', {
          name: locale === 'en' ? 'English' : '简体中文',
        }),
      );
      expect(capsule.querySelector('span[aria-hidden="true"]')).toBe(indicator);
      expect(indicator).toHaveStyle({
        transform: `translateX(${SUPPORTED_LOCALES.indexOf(locale) * 100}%)`,
      });
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(locale);
    }
    expect(capsule.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(1);
  });

  it('保留非紧凑外观的可见语言标签', () => {
    renderSwitcher(false);
    expect(screen.getByText('界面语言')).toBeVisible();
    expect(screen.getByRole('group', { name: '切换语言' })).toBeInTheDocument();
  });

  it('悬停及聚焦只展示选项，不改变语言偏好', () => {
    renderSwitcher();
    const capsule = screen.getByRole('group', { name: '切换语言' });
    fireEvent.mouseEnter(capsule);
    act(() => screen.getByRole('button', { name: '简体中文' }).focus());
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it('点击后立即沿用原语言切换、选中状态与持久化行为', () => {
    renderSwitcher();
    const chinese = screen.getByRole('button', { name: '简体中文' });
    const english = screen.getByRole('button', { name: 'English' });
    fireEvent.click(english);
    expect(english).toHaveAttribute('aria-pressed', 'true');
    expect(chinese).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('group', { name: 'Change language' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    fireEvent.click(chinese);
    expect(chinese).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN');
  });

  it('方向键与 Home/End 只移动焦点，选项顺序及 DOM 身份保持稳定', () => {
    renderSwitcher();
    const chinese = screen.getByRole('button', { name: '简体中文' });
    const english = screen.getByRole('button', { name: 'English' });
    act(() => chinese.focus());
    fireEvent.keyDown(chinese, { key: 'ArrowRight' });
    expect(english).toHaveFocus();
    fireEvent.keyDown(english, { key: 'ArrowRight' });
    expect(chinese).toHaveFocus();
    fireEvent.keyDown(chinese, { key: 'ArrowLeft' });
    expect(english).toHaveFocus();
    fireEvent.keyDown(english, { key: 'Home' });
    expect(chinese).toHaveFocus();
    fireEvent.keyDown(chinese, { key: 'End' });
    expect(english).toHaveFocus();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
    fireEvent.click(english);
    expect(screen.getByRole('button', { name: 'English' })).toBe(english);
    expect(english).toHaveFocus();
    expect(screen.getAllByRole('button')).toEqual([chinese, english]);
    // 胶囊不是弹窗，不接管 Esc/Tab，避免破坏设置对话框的关闭与焦点边界。
    expect(fireEvent.keyDown(english, { key: 'Escape' })).toBe(true);
    expect(fireEvent.keyDown(english, { key: 'Tab' })).toBe(true);
  });
});
