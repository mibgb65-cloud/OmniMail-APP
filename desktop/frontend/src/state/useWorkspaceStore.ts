import { startTransition, useCallback, useEffect, useState } from "react";
import { INITIAL_SETTINGS } from "../data/settingsDefaults";
import { setCurrentLanguage, t } from "../i18n";
import {
  accountApi,
  contactApi,
  profileApi,
  ruleApi,
} from "../services/backendClient";
import type {
  AppSettings,
  ThemeMode,
  ThemePreference,
} from "../types/settings";
import type {
  OverlayModal,
  RuntimeBannerMode,
  WorkspaceScreen,
} from "../types/ui";
import { resolveThemeFromPref } from "./storageHelpers";
import { scheduleSettingsPersist } from "./themeStorage";
import {
  getEffectiveTheme,
  readInitialThemeState,
  runThemeTransition,
} from "./themeTransition";
import { reconcileRuntimeSyncState } from "./accountSyncState";
import { useWorkspaceCollections } from "./useWorkspaceCollections";

export function useWorkspaceStore() {
  const collections = useWorkspaceCollections();
  const [screen, setScreen] = useState<WorkspaceScreen>("mail");
  const [settings, setSettings] = useState<AppSettings>(() => {
    const initial = { ...INITIAL_SETTINGS, ...readInitialThemeState() };
    setCurrentLanguage(initial.language);
    return initial;
  });
  const [overlay, setOverlay] = useState<OverlayModal>({ type: "none" });
  const [bannerMode, setBannerMode] = useState<RuntimeBannerMode>("none");
  const [syncLabel, setSyncLabel] = useState(() =>
    t("topbar.allAccountsSynced"),
  );
  const [compactView, setCompactView] = useState<"list" | "reader">("reader");
  const [leftNavOpen, setLeftNavOpen] = useState(false);

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

  const {
    nextBannerMode: effectiveBannerMode,
    nextSyncLabel: effectiveSyncLabel,
  } = reconcileRuntimeSyncState({
    accounts: collections.accounts,
    bannerMode,
    syncLabel,
    lang: settings.language,
  });

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
  }, [settings.themePreference]);

  const applySettingsFromBackend = useCallback(
    (patch: Partial<AppSettings>) => {
      if (patch.language) setCurrentLanguage(patch.language, true);
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
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
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode =
      getEffectiveTheme() === "light" ? "dark" : "light";
    updateSettings({ theme: nextTheme, themePreference: nextTheme });
  }, [updateSettings]);

  const {
    setProfiles,
    setActiveProfileId,
    setLaunchBehavior,
    setAccounts,
    setContacts,
    setBlacklist,
    setRules,
    clearCollections,
  } = collections;

  const refreshProfilesAndAccounts = useCallback(async () => {
    const profList = await profileApi.listProfiles();
    setProfiles(profList.profiles);
    setActiveProfileId(profList.activeProfileId);
    setLaunchBehavior(profList.launchBehavior);
    if (profList.requiresUnlock) {
      setOverlay({
        type: "profile-manage",
        mode: "unlock",
        targetProfileId: profList.activeProfileId,
      });
      return profList;
    }
    const [appCfg, accs, cnts, blks, rls] = await Promise.all([
      profileApi.getAppSettings().catch(() => null),
      accountApi.listAccounts().catch(() => []),
      contactApi.listContacts().catch(() => []),
      contactApi.listBlacklist().catch(() => []),
      ruleApi.listRules().catch(() => []),
    ]);
    if (appCfg) setSettings((prev) => ({ ...prev, ...appCfg }));
    setAccounts(accs);
    setContacts(cnts);
    setBlacklist(blks);
    setRules(rls);
    return profList;
  }, [
    setAccounts,
    setActiveProfileId,
    setBlacklist,
    setContacts,
    setLaunchBehavior,
    setProfiles,
    setRules,
  ]);

  const resetLocalData = useCallback(() => {
    clearCollections();
    setScreen("onboarding");
  }, [clearCollections]);

  return {
    ...collections,
    screen,
    setScreen,
    settings,
    updateSettings,
    applySettingsFromBackend,
    toggleTheme,
    overlay,
    setOverlay,
    bannerMode: effectiveBannerMode,
    setBannerMode,
    syncLabel: effectiveSyncLabel,
    setSyncLabel,
    compactView,
    setCompactView,
    leftNavOpen,
    setLeftNavOpen,
    refreshProfilesAndAccounts,
    resetLocalData,
  };
}
