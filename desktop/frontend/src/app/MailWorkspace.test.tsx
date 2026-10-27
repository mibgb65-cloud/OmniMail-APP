import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { I18nProvider } from '../lib/i18n/I18nProvider';
import { MailWorkspace } from './MailWorkspace';

describe('邮件与 AI 分析区域', () => {
  it('通栏工具条位于邮件列表和内容双列的上方', () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <MailWorkspace />
      </I18nProvider>,
    );
    const area = screen.getByRole('region', { name: '邮件工作区' });
    const toolbar = within(area).getByRole('toolbar', { name: '邮件工具栏' });
    const list = within(area).getByRole('region', { name: '邮件列表' });
    const reader = within(area).getByRole('region', { name: '邮件查看' });
    expect(toolbar.parentElement).toBe(area);
    expect(list.parentElement).toBe(reader.parentElement);
    expect(toolbar.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['zh-CN', '邮件工作区', '邮件列表', '邮件查看', 'AI 分析', '收起 AI 分析', '展开 AI 分析'],
    [
      'en',
      'Email workspace',
      'Mail list',
      'Email viewer',
      'AI analysis',
      'Collapse AI analysis',
      'Expand AI analysis',
    ],
  ] as const)('%s 支持收起和展开 AI 面板', (locale, mail, list, reader, ai, collapse, expand) => {
    render(
      <I18nProvider initialLocale={locale}>
        <MailWorkspace />
      </I18nProvider>,
    );
    const mailArea = screen.getByRole('region', { name: mail });
    expect(within(mailArea).getByRole('region', { name: list })).toBeVisible();
    expect(within(mailArea).getByRole('region', { name: reader })).toBeVisible();
    const analysis = screen.getByRole('complementary', { name: ai });
    const button = within(analysis).getByRole('button', { name: collapse });
    const content = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(content).toBeVisible();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAccessibleName(expand);
    expect(content).not.toBeVisible();
    expect(mailArea).toBeVisible();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(content).toBeVisible();
  });
});
