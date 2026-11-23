import { useCallback, useState } from "react";
import { INITIAL_ACCOUNTS } from "../data/accounts";
import { INITIAL_BLACKLIST, INITIAL_CONTACTS } from "../data/contacts";
import { INITIAL_RULES } from "../data/rulesAndDiagnostics";
import {
  contactApi,
  ruleApi,
  type ProfileSummary,
} from "../services/backendClient";
import type { EmailAccount } from "../types/account";
import type {
  BlacklistEntry,
  ContactItem,
  InboxRule,
} from "../types/workspace";
import { isWailsDesktop } from "./storageHelpers";

export function useWorkspaceCollections() {
  const desktop = isWailsDesktop();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("personal");
  const [launchBehavior, setLaunchBehavior] = useState<
    "last-profile" | "ask-on-launch"
  >("last-profile");

  const [accounts, setAccounts] = useState<EmailAccount[]>(() =>
    desktop ? [] : INITIAL_ACCOUNTS,
  );
  const [contacts, setContacts] = useState<ContactItem[]>(() =>
    desktop ? [] : INITIAL_CONTACTS,
  );
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(() =>
    desktop ? [] : INITIAL_BLACKLIST,
  );
  const [rules, setRules] = useState<InboxRule[]>(() =>
    desktop ? [] : INITIAL_RULES,
  );

  const addAccount = useCallback((acc: EmailAccount) => {
    setAccounts((prev) =>
      prev.some((a) => a.id === acc.id)
        ? prev.map((a) => (a.id === acc.id ? acc : a))
        : [...prev, acc],
    );
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
    setContacts((prev) =>
      prev.some((c) => c.id === contact.id)
        ? prev.map((c) => (c.id === contact.id ? contact : c))
        : [contact, ...prev],
    );
    void contactApi
      .saveContact(contact)
      .then((saved) =>
        setContacts((prev) =>
          prev.some((c) => c.id === contact.id || c.id === saved.id)
            ? prev.map((c) =>
                c.id === contact.id || c.id === saved.id ? saved : c,
              )
            : [saved, ...prev],
        ),
      )
      .catch(() => undefined);
  }, []);

  const deleteContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    void contactApi.deleteContact(id).catch(() => undefined);
  }, []);

  const toggleContactVip = useCallback((id: string) => {
    setContacts((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) {
        void contactApi
          .saveContact({ ...target, vip: !target.vip })
          .catch(() => undefined);
      }
      return prev.map((c) => (c.id === id ? { ...c, vip: !c.vip } : c));
    });
  }, []);

  const removeBlacklist = useCallback((id: string) => {
    setBlacklist((prev) => prev.filter((b) => b.id !== id));
    void contactApi.removeBlacklist(id).catch(() => undefined);
  }, []);

  const addBlacklist = useCallback((entry: Omit<BlacklistEntry, "id">) => {
    void contactApi
      .addBlacklist(entry.target, entry.kind, entry.reason)
      .then((saved) =>
        setBlacklist((prev) => [
          saved,
          ...prev.filter((b) => b.target !== saved.target),
        ]),
      )
      .catch(() => undefined);
  }, []);

  const upsertRule = useCallback((rule: InboxRule) => {
    setRules((prev) =>
      prev.some((r) => r.id === rule.id)
        ? prev.map((r) => (r.id === rule.id ? rule : r))
        : [rule, ...prev],
    );
    void ruleApi
      .saveRule(rule)
      .then((saved) =>
        setRules((prev) =>
          prev.some((r) => r.id === rule.id || r.id === saved.id)
            ? prev.map((r) =>
                r.id === rule.id || r.id === saved.id ? saved : r,
              )
            : [saved, ...prev],
        ),
      )
      .catch(() => undefined);
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) {
        void ruleApi
          .saveRule({ ...target, enabled: !target.enabled })
          .catch(() => undefined);
      }
      return prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    });
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    void ruleApi.deleteRule(id).catch(() => undefined);
  }, []);

  const clearCollections = useCallback(() => {
    setAccounts([]);
    setContacts([]);
    setBlacklist([]);
    setRules([]);
  }, []);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;

  return {
    profiles,
    setProfiles,
    activeProfileId,
    setActiveProfileId,
    activeProfile,
    launchBehavior,
    setLaunchBehavior,
    accounts,
    setAccounts,
    addAccount,
    updateAccount,
    removeAccount,
    contacts,
    setContacts,
    upsertContact,
    deleteContact,
    toggleContactVip,
    blacklist,
    setBlacklist,
    addBlacklist,
    removeBlacklist,
    rules,
    setRules,
    upsertRule,
    toggleRule,
    deleteRule,
    clearCollections,
  };
}
