import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { THEME_STORAGE_KEY } from '../../lib/theme/theme';
import { useTheme } from '../../lib/theme/useTheme';
import { SettingsAppearance } from './SettingsAppearance';

function Preview() {
  const { themePreference, selectTheme } = useTheme();
  return (
    <SettingsAppearance themePreference={themePreference} onThemePreferenceChange={selectTheme} />
  );
}
function renderAppearance() {
  return render(
    <I18nProvider initialLocale="zh-CN">
      <Preview />
    </I18nProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

it('三段滑块具备单选语义，选中底块跟随三种模式移动', () => {
  renderAppearance();
  const group = screen.getByRole('radiogroup', { name: '外观' });
  expect(group).toHaveAccessibleDescription('选择亮色、暗色，或随系统外观自动切换。');
  expect(screen.getAllByRole('radio').map((option) => option.getAttribute('value'))).toEqual([
    'light',
    'dark',
    'system',
  ]);
  const indicator = group.querySelector('[aria-hidden="true"]');
  expect(screen.getByRole('radio', { name: '跟随系统' })).toBeChecked();
  expect(indicator).toHaveStyle({ transform: 'translateX(200%)' });
  fireEvent.click(screen.getByRole('radio', { name: '亮色模式' }));
  expect(indicator).toHaveStyle({ transform: 'translateX(0%)' });
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  fireEvent.click(screen.getByRole('radio', { name: '暗色模式' }));
  expect(indicator).toHaveStyle({ transform: 'translateX(100%)' });
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  fireEvent.click(screen.getByRole('radio', { name: '跟随系统' }));
  expect(indicator).toHaveStyle({ transform: 'translateX(200%)' });
});

it.each([
  ['light', '亮色模式'],
  ['dark', '暗色模式'],
  ['system', '跟随系统'],
])('%s 选择保存后重开仍保持，滑块仅当前项参与 Tab 导航', (value, label) => {
  const view = renderAppearance();
  if (value === 'system') fireEvent.click(screen.getByRole('radio', { name: '亮色模式' }));
  fireEvent.click(screen.getByRole('radio', { name: label }));
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(value);
  view.unmount();
  renderAppearance();
  expect(screen.getByRole('radio', { name: label })).toBeChecked();
  expect(screen.getAllByRole('radio').filter((item) => item.tabIndex === 0)).toEqual([
    screen.getByRole('radio', { name: label }),
  ]);
});

it('方向键与 Home/End 调整选中项并同步焦点', () => {
  renderAppearance();
  const system = screen.getByRole('radio', { name: '跟随系统' });
  const dark = screen.getByRole('radio', { name: '暗色模式' });
  const light = screen.getByRole('radio', { name: '亮色模式' });
  system.focus();
  fireEvent.keyDown(system, { key: 'ArrowLeft' });
  expect(dark).toBeChecked();
  expect(dark).toHaveFocus();
  fireEvent.keyDown(dark, { key: 'Home' });
  expect(light).toBeChecked();
  expect(light).toHaveFocus();
  fireEvent.keyDown(light, { key: 'ArrowUp' });
  expect(system).toBeChecked();
  expect(system).toHaveFocus();
  fireEvent.keyDown(system, { key: 'ArrowDown' });
  expect(light).toBeChecked();
  fireEvent.keyDown(light, { key: 'End' });
  expect(system).toHaveFocus();
});

it('写入失败仍应用主题并显示安全提示，恢复写入后提示消失', () => {
  renderAppearance();
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('private-token');
  });
  fireEvent.click(screen.getByRole('radio', { name: '暗色模式' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('radio', { name: '暗色模式' })).toBeChecked();
  expect(screen.getByRole('alert')).toHaveTextContent('当前无法保存外观偏好');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private-token');
  blocked.mockRestore();
  fireEvent.click(screen.getByRole('radio', { name: '跟随系统' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
