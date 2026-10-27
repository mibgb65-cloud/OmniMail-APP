import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { SearchField } from './SearchField';
import { getSearchShortcutLabel } from './searchShortcut';

function Harness() {
  const [value, setValue] = useState('');
  return (
    <SearchField
      label="搜索邮件"
      placeholder="搜索邮件…"
      clearLabel="清除搜索"
      value={value}
      onValueChange={setValue}
    />
  );
}

describe('搜索框', () => {
  it('空且未聚焦时显示快捷键徽章，聚焦后隐藏', () => {
    render(<Harness />);
    const input = screen.getByRole('searchbox', { name: '搜索邮件' });
    expect(screen.getByText(getSearchShortcutLabel())).toBeInTheDocument();
    fireEvent.focus(input);
    expect(screen.queryByText(getSearchShortcutLabel())).not.toBeInTheDocument();
    fireEvent.blur(input);
    expect(screen.getByText(getSearchShortcutLabel())).toBeInTheDocument();
  });

  it.each([['ctrlKey'], ['metaKey']] as const)('%s+K 聚焦搜索框并选中已有内容', (modifier) => {
    render(<Harness />);
    const input = screen.getByRole('searchbox', { name: '搜索邮件' });
    fireEvent.change(input, { target: { value: '季度报告' } });
    fireEvent.blur(input);
    expect(input).not.toHaveFocus();
    fireEvent.keyDown(window, { key: 'k', [modifier]: true });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('季度报告');
  });

  it('其他快捷键组合不抢占焦点', () => {
    render(<Harness />);
    const input = screen.getByRole('searchbox', { name: '搜索邮件' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
    expect(input).not.toHaveFocus();
  });

  it('有内容时出现圆形清除按钮，点击清空并保持聚焦', () => {
    render(<Harness />);
    const input = screen.getByRole('searchbox', { name: '搜索邮件' });
    expect(screen.queryByRole('button', { name: '清除搜索' })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '发票' } });
    const clear = screen.getByRole('button', { name: '清除搜索' });
    expect(clear.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(clear);
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: '清除搜索' })).not.toBeInTheDocument();
  });

  it('快捷键徽章按平台给出 Ctrl K 或 ⌘K', () => {
    expect(getSearchShortcutLabel('Win32')).toBe('Ctrl K');
    expect(getSearchShortcutLabel('Linux x86_64')).toBe('Ctrl K');
    expect(getSearchShortcutLabel('MacIntel')).toBe('⌘K');
  });
});
