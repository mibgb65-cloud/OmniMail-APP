import { SaveThemePreference } from "../../bindings/omnimail/desktopservice";
import { INITIAL_SETTINGS } from "../data/settingsDefaults";
import { profileApi } from "../services/backendClient";
import type {
  AppSettings,
  ThemeMode,
  ThemePreference,
} from "../types/settings";
import { syncDesktopPreferences } from "./desktopActions";
import {
  THEME_PREF_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isWailsDesktop,
  resolveThemeFromPref,
} from "./storageHelpers";

export function readInitialThemeState(): {
  theme: ThemeMode;
  themePreference: ThemePreference;
} {
  let pref: ThemePreference = INITIAL_SETTINGS.themePreference;
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(THEME_PREF_STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        pref = saved;
      }
    } catch {
      // 忽略受限存储环境异常
    }
  }
  const attr =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme")
      : null;
  const resolved: ThemeMode =
    attr === "dark" || attr === "light" ? attr : resolveThemeFromPref(pref);
  return { theme: resolved, themePreference: pref };
}

export function persistLocalTheme(pref: ThemePreference, resolved: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_PREF_STORAGE_KEY, pref);
    window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
  } catch {
    // 忽略受限存储环境异常
  }
  if (isWailsDesktop()) void SaveThemePreference(pref).catch(() => undefined);
}

let persistDebounceTimer = 0;

export function scheduleSettingsPersist(
  merged: AppSettings,
  persistPatch: Partial<AppSettings>,
) {
  window.clearTimeout(persistDebounceTimer);
  persistDebounceTimer = window.setTimeout(() => {
    persistLocalTheme(merged.themePreference, merged.theme);
    void profileApi.updateAppSettings(persistPatch).catch(() => undefined);
    void syncDesktopPreferences(merged);
  }, 220);
}

let lastPointer = { x: 0, y: 0, ts: 0 };

if (typeof window !== "undefined") {
  const recordPointer = (e: MouseEvent | PointerEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    lastPointer = { x: e.clientX, y: e.clientY, ts: Date.now() };
  };
  window.addEventListener("pointerdown", recordPointer, {
    passive: true,
    capture: true,
  });
  window.addEventListener("click", recordPointer, {
    passive: true,
    capture: true,
  });
}

export function resolveThemeOrigin(): { x: number; y: number } {
  if (Date.now() - lastPointer.ts < 900) {
    return { x: lastPointer.x, y: lastPointer.y };
  }
  const seg = document.querySelector(".theme-segmented");
  if (seg) {
    const r = seg.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: Math.max(40, window.innerWidth - 88), y: 36 };
}
