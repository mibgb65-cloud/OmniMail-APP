import { useCallback, useRef, useState } from "react";
import { INITIAL_SETTINGS } from "../data/settingsDefaults";
import { getCurrentLanguage, setCurrentLanguage, t } from "../i18n";
import {
  accountApi,
  contactApi,
  profileApi,
  ruleApi,
} from "../services/backendClient";
import type { EmailAccount } from "../types/account";
import type { AppSettings } from "../types/settings";
import type {
  OverlayModal,
  RuntimeBannerMode,
  WorkspaceScreen,
} from "../types/ui";
import {
  deriveAccountSyncState,
  reconcileRuntimeSyncState,
  resolveIdleSyncLabel,
} from "./accountSyncState";
import { readInitialThemeState } from "./themeTransition";
import { useWorkspaceCollections } from "./useWorkspaceCollections";
import { useWorkspaceThemeSettings } from "./useWorkspaceTheme";

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
  const [manualSyncCount, setManualSyncCount] = useState(0);
  const manualSyncCountRef = useRef(0);
  const [compactView, setCompactView] = useState<"list" | "reader">("reader");
  const [leftNavOpen, setLeftNavOpen] = useState(false);

  const manualSyncPending = manualSyncCount > 0;
  const beginManualSync = useCallback(() => {
    manualSyncCountRef.current += 1;
    setManualSyncCount(manualSyncCountRef.current);
  }, []);
  const endManualSync = useCallback(() => {
    manualSyncCountRef.current = Math.max(0, manualSyncCountRef.current - 1);
    setManualSyncCount(manualSyncCountRef.current);
  }, []);
  const resetManualSync = useCallback(() => {
    manualSyncCountRef.current = 0;
    setManualSyncCount(0);
  }, []);

  const { applySettingsFromBackend, updateSettings, toggleTheme } =
    useWorkspaceThemeSettings(settings, setSettings);

  const {
    nextBannerMode: effectiveBannerMode,
    nextSyncLabel: effectiveSyncLabel,
  } = reconcileRuntimeSyncState({
    accounts: collections.accounts,
    bannerMode,
    syncLabel,
    lang: settings.language,
    manualSyncPending,
  });

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
      return { ...profList, accounts: [] as EmailAccount[] };
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
    if (
      accs.length > 0 &&
      manualSyncCountRef.current === 0 &&
      deriveAccountSyncState(accs).syncingAccounts.length === 0
    ) {
      const nextLang = appCfg?.language ?? getCurrentLanguage();
      setSyncLabel(resolveIdleSyncLabel(accs, nextLang));
    }
    setContacts(cnts);
    setBlacklist(blks);
    setRules(rls);
    return { ...profList, accounts: accs };
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
    manualSyncCountRef.current = 0;
    setManualSyncCount(0);
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
    manualSyncPending,
    beginManualSync,
    endManualSync,
    resetManualSync,
    compactView,
    setCompactView,
    leftNavOpen,
    setLeftNavOpen,
    refreshProfilesAndAccounts,
    resetLocalData,
  };
}
