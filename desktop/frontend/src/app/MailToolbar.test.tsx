import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getSearchShortcutLabel } from '../components/SearchField/searchShortcut';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { MailToolbar } from './MailToolbar';

describe('邮件通栏工具条', () => {
  it.each([
    [
      'zh-CN',
      '邮件工具栏',
      '搜索邮件',
      '清除搜索',
      ['同步邮件', '归档', '删除', '标为已读/未读', '全部已读', '上一封', '下一封'],
      '— 封邮件',
    ],
    [
      'en',
      'Mail toolbar',
      'Search email',
      'Clear search',
      [
        'Sync email',
        'Archive',
        'Delete',
        'Mark as read/unread',
        'Mark all as read',
        'Previous email',
        'Next email',
      ],
      '— emails',
    ],
  ] as const)(
    '%s 按顺序展示控件，不伪造可用操作及数量',
    (locale, toolbarLabel, searchLabel, clearLabel, actions, count) => {
      render(
        <I18nProvider initialLocale={locale}>
          <MailToolbar />
        </I18nProvider>,
      );
      const toolbar = screen.getByRole('toolbar', { name: toolbarLabel });
      const input = within(toolbar).getByRole('searchbox', { name: searchLabel });
      expect(input).toBeEnabled();
      expect(input).toHaveAttribute('maxlength', '200');
      expect(input).toHaveValue('');
      const buttons = within(toolbar).getAllByRole('button');
      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(actions);
      for (const [index, button] of buttons.entries()) {
        expect(button).toHaveAttribute('data-button-variant', index === 0 ? 'secondary' : 'ghost');
        expect(button).toBeDisabled();
        expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      }
      // 空且未聚焦时展示快捷键徽章，不占用按钮语义
      expect(within(toolbar).getByText(getSearchShortcutLabel())).toBeInTheDocument();
      fireEvent.change(input, { target: { value: '项目进展' } });
      expect(input).toHaveValue('项目进展');
      expect(within(toolbar).queryByText(getSearchShortcutLabel())).not.toBeInTheDocument();
      const clear = within(toolbar).getByRole('button', { name: clearLabel });
      expect(clear).toBeEnabled();
      fireEvent.click(clear);
      expect(input).toHaveValue('');
      expect(input).toHaveFocus();
      expect(within(toolbar).queryByRole('button', { name: clearLabel })).not.toBeInTheDocument();
      expect(within(toolbar).getByText(count)).toBeVisible();
    },
  );
});
