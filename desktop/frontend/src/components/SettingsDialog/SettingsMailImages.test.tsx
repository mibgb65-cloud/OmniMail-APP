import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { IMAGE_POLICY_STORAGE_KEY, setImagePolicy } from '../../lib/preferences/mailImages';
import { SettingsMailImages } from './SettingsMailImages';

beforeEach(() => {
  setImagePolicy('inline');
  localStorage.clear();
});
function setup(locale: 'zh-CN' | 'en' = 'zh-CN') {
  return render(
    <I18nProvider initialLocale={locale}>
      <SettingsMailImages />
    </I18nProvider>,
  );
}
it('保持三种完整读屏名称与默认策略，推荐标签独立展示且图标为装饰', () => {
  setup();
  const options = screen.getAllByRole('radio');
  expect(options.map((option) => option.getAttribute('aria-label'))).toEqual([
    '不显示图片',
    '仅显示内嵌图片（推荐）',
    '显示全部图片（包含外链图片）',
  ]);
  expect(options[1]).toBeChecked();
  expect(screen.getByText('推荐')).toBeVisible();
  for (const option of options) {
    expect(option.closest('label')?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  }
  expect(options.filter((option) => option.tabIndex === 0)).toEqual([options[1]]);
});
it('整行点击保存策略，重开后保留且选中不只依赖颜色', () => {
  const view = setup();
  const all = screen.getByRole('radio', { name: '显示全部图片（包含外链图片）' });
  const row = all.closest('label');
  if (!row) throw new Error('缺少可点击行');
  fireEvent.click(row);
  expect(all).toBeChecked();
  expect(row).toHaveAttribute('data-selected', 'true');
  expect(localStorage.getItem(IMAGE_POLICY_STORAGE_KEY)).toBe('all');
  expect(row.querySelectorAll('svg')).toHaveLength(2);
  view.unmount();
  setup();
  expect(screen.getByRole('radio', { name: '显示全部图片（包含外链图片）' })).toBeChecked();
});
it('方向键和 Home/End 更新选择并跟随焦点', () => {
  setup();
  const [none, inline, all] = screen.getAllByRole('radio');
  if (!none || !inline || !all) throw new Error('缺少图片选项');
  inline.focus();
  fireEvent.keyDown(inline, { key: 'ArrowDown' });
  expect(all).toBeChecked();
  expect(all).toHaveFocus();
  fireEvent.keyDown(all, { key: 'Home' });
  expect(none).toBeChecked();
  expect(none).toHaveFocus();
  fireEvent.keyDown(none, { key: 'ArrowUp' });
  expect(all).toBeChecked();
  fireEvent.keyDown(all, { key: 'End' });
  expect(all).toHaveFocus();
});
it('保存失败仍仅本会话生效，不泄漏原始错误，恢复后提示消失', () => {
  setup();
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('private-path-token');
  });
  fireEvent.click(screen.getByRole('radio', { name: '不显示图片' }));
  expect(screen.getByRole('radio', { name: '不显示图片' })).toBeChecked();
  expect(screen.getByRole('alert')).toHaveTextContent('当前无法保存偏好');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private-path-token');
  blocked.mockRestore();
  fireEvent.click(screen.getByRole('radio', { name: '仅显示内嵌图片（推荐）' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('英文读屏名称与独立推荐标记齐备', () => {
  setup('en');
  expect(screen.getByRole('radio', { name: 'Embedded images only (recommended)' })).toBeChecked();
  expect(screen.getByText('Recommended')).toBeVisible();
});
