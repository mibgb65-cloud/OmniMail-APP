import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { applyTheme, persistTheme, readInitialTheme, readThemePreference } from './theme';

export function useTheme() {
  const [theme, setTheme] = useState(readInitialTheme);
  const manual = useRef(readThemePreference() !== null);

  useLayoutEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => {
      if (!manual.current) setTheme(media?.matches ? 'dark' : 'light');
    };
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    // 即便持久化失败，本会话内的手动选择也不应被系统主题变化覆盖。
    manual.current = true;
    persistTheme(next);
    setTheme(next);
  };

  return { theme, toggleTheme };
}
