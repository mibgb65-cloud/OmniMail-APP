import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { LanguageSwitcher } from './LanguageSwitcher';

describe('设置语言选择器', () => {
  it('使用显示当前语言的自绘按钮，而不是系统原生下拉框', () => {
    const view = render(
      <I18nProvider initialLocale="zh-CN">
        <LanguageSwitcher compact />
      </I18nProvider>,
    );
    expect(view.container.querySelector('select')).toBeNull();
    const trigger = screen.getByRole('button', { name: '界面语言' });
    expect(trigger).toHaveTextContent('简体中文');
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitemradio', { name: '简体中文' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'Language' })).toHaveTextContent('English');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
