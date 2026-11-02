export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
export const THEME_STORAGE_KEY = 'omnimail.theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return isTheme(value) || value === 'system';
}

export function readThemePreference(): ThemePreference {
  try {
    const stored: unknown = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // 存储不可用时仍允许启动和切换，不将底层诊断信息暴露到界面。
    return 'system';
  }
}

export function readInitialTheme(): Theme {
  const preference = readThemePreference();
  return preference === 'system' ? readSystemTheme() : preference;
}

export function readSystemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  if (isTheme(theme)) document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: ThemePreference): boolean {
  if (!isThemePreference(theme)) return false;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
