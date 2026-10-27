export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'omnimail.theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function readThemePreference(): Theme | null {
  try {
    const stored: unknown = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    // 存储不可用时仍允许启动和切换，不将底层诊断信息暴露到界面。
    return null;
  }
}

export function readInitialTheme(): Theme {
  return (
    readThemePreference() ??
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
}

export function applyTheme(theme: Theme): void {
  if (isTheme(theme)) document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: Theme): boolean {
  if (!isTheme(theme)) return false;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
