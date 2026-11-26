import {
  startTransition,
  useCallback,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from "react";
import { setCurrentLanguage } from "../i18n";
import type {
  AppSettings,
  ThemeMode,
  ThemePreference,
} from "../types/settings";
import { resolveThemeFromPref } from "./storageHelpers";
import { scheduleSettingsPersist } from "./themeStorage";
import { getEffectiveTheme, runThemeTransition } from "./themeTransition";

export function useWorkspaceThemeSettings(
  settings: AppSettings,
  setSettings: Dispatch<SetStateAction<AppSettings>>,
) {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") !== settings.theme) {
      root.setAttribute("data-theme", settings.theme);
      root.style.colorScheme = settings.theme;
    }
  }, [settings.theme]);

  useEffect(() => {
    setCurrentLanguage(settings.language, true);
  }, [settings.language]);

  useEffect(() => {
    if (settings.themePreference !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: ThemeMode = mq.matches ? "dark" : "light";
      runThemeTransition(next, (finalTheme) => {
        startTransition(() => {
          setSettings((prev) => ({ ...prev, theme: finalTheme }));
        });
      });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.themePreference, setSettings]);

  const applySettingsFromBackend = useCallback(
    (patch: Partial<AppSettings>) => {
      if (patch.language) setCurrentLanguage(patch.language, true);
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [setSettings],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      if (patch.language) setCurrentLanguage(patch.language, true);
      let nextPref: ThemePreference | undefined = patch.themePreference;
      if (!nextPref && patch.theme) nextPref = patch.theme;
      const nextResolved: ThemeMode | undefined = nextPref
        ? resolveThemeFromPref(nextPref)
        : patch.theme;

      if (nextResolved) {
        runThemeTransition(nextResolved, (finalTheme) => {
          const finalPref: ThemePreference =
            nextPref === "system" ? "system" : finalTheme;
          const finalPatch: Partial<AppSettings> = {
            ...patch,
            themePreference: finalPref,
            theme: finalTheme,
          };
          startTransition(() => {
            setSettings((prev) => {
              const merged: AppSettings = { ...prev, ...finalPatch };
              scheduleSettingsPersist(merged, finalPatch);
              return merged;
            });
          });
        });
        return;
      }

      setSettings((prev) => {
        const merged: AppSettings = { ...prev, ...patch };
        scheduleSettingsPersist(merged, patch);
        return merged;
      });
    },
    [setSettings],
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode =
      getEffectiveTheme() === "light" ? "dark" : "light";
    updateSettings({ theme: nextTheme, themePreference: nextTheme });
  }, [updateSettings]);

  return { applySettingsFromBackend, updateSettings, toggleTheme };
}
