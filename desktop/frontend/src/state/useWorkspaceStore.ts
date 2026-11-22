import { useCallback, useEffect, useState } from "react";
import { INITIAL_ACCOUNTS } from "../data/accounts";
import { INITIAL_BLACKLIST, INITIAL_CONTACTS } from "../data/contacts";
import { INITIAL_RULES } from "../data/rulesAndDiagnostics";
import { INITIAL_SETTINGS } from "../data/settingsDefaults";
import type { EmailAccount } from "../types/account";
import type { AppSettings } from "../types/settings";
import type {
  OverlayModal,
  RuntimeBannerMode,
  WorkspaceScreen,
} from "../types/ui";
import type {
  BlacklistEntry,
  ContactItem,
  InboxRule,
} from "../types/workspace";

export function useWorkspaceStore() {
  const [screen, setScreen] = useState<WorkspaceScreen>("mail");
  const [accounts, setAccounts] = useState<EmailAccount[]>(INITIAL_ACCOUNTS);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [contacts, setContacts] = useState<ContactItem[]>(INITIAL_CONTACTS);
  const [blacklist, setBlacklist] =
    useState<BlacklistEntry[]>(INITIAL_BLACKLIST);
  const [rules, setRules] = useState<InboxRule[]>(INITIAL_RULES);
  const [overlay, setOverlay] = useState<OverlayModal>({ type: "none" });
  const [bannerMode, setBannerMode] = useState<RuntimeBannerMode>("none");
  const [syncLabel, setSyncLabel] = useState("所有邮箱已同步");
  const [compactView, setCompactView] = useState<"list" | "reader">("reader");
  const [leftNavOpen, setLeftNavOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === "light" ? "dark" : "light",
    }));
  }, []);

  const addAccount = useCallback((acc: EmailAccount) => {
    setAccounts((prev) => [...prev, acc]);
  }, []);

  const updateAccount = useCallback(
    (id: string, patch: Partial<EmailAccount>) => {
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [],
  );

  const removeAccount = useCallback((id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const upsertContact = useCallback((contact: ContactItem) => {
    setContacts((prev) => {
      const exists = prev.some((c) => c.id === contact.id);
      return exists
        ? prev.map((c) => (c.id === contact.id ? contact : c))
        : [contact, ...prev];
    });
  }, []);

  const toggleContactVip = useCallback((id: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, vip: !c.vip } : c)),
    );
  }, []);

  const removeBlacklist = useCallback((id: string) => {
    setBlacklist((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const addBlacklist = useCallback((entry: Omit<BlacklistEntry, "id">) => {
    setBlacklist((prev) => [{ ...entry, id: `bl-${Date.now()}` }, ...prev]);
  }, []);

  const upsertRule = useCallback((rule: InboxRule) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === rule.id);
      return exists
        ? prev.map((r) => (r.id === rule.id ? rule : r))
        : [rule, ...prev];
    });
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const resetLocalData = useCallback(() => {
    setAccounts([]);
    setContacts([]);
    setRules([]);
    setScreen("onboarding");
  }, []);

  return {
    screen,
    setScreen,
    accounts,
    addAccount,
    updateAccount,
    removeAccount,
    settings,
    updateSettings,
    toggleTheme,
    contacts,
    upsertContact,
    toggleContactVip,
    blacklist,
    addBlacklist,
    removeBlacklist,
    rules,
    upsertRule,
    toggleRule,
    deleteRule,
    overlay,
    setOverlay,
    bannerMode,
    setBannerMode,
    syncLabel,
    setSyncLabel,
    compactView,
    setCompactView,
    leftNavOpen,
    setLeftNavOpen,
    resetLocalData,
  };
}
