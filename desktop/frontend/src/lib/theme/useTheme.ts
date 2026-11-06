import { useEffect, useLayoutEffect, useState } from 'react';

import {
  applyTheme,
  isThemePreference,
  persistTheme,
  readSystemTheme,
  readThemePreference,
  type ThemePreference,
} from './theme';

export function useTheme() {
  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);
  // 偏好是三态，DOM 配色仍只有亮/暗两态；系统变化不能覆盖用户的固定配色。
  const theme = themePreference === 'system' ? systemTheme : themePreference;

  useLayoutEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => {
      setSystemTheme(media?.matches ? 'dark' : 'light');
    };
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, []);

  const selectTheme = (preference: ThemePreference): boolean => {
    if (!isThemePreference(preference)) return false;
    const saved = persistTheme(preference);
    setThemePreference(preference);
    // 恢复系统时立即重新读取，避免依赖上一次 change 事件或监听建立前的旧快照。
    if (preference === 'system') setSystemTheme(readSystemTheme());
    return saved;
  };
  const toggleTheme = () => selectTheme(theme === 'dark' ? 'light' : 'dark');

  return { theme, themePreference, selectTheme, toggleTheme };
}
