import { LEGAL_DOCS } from "../data/legalDocsZh.ts";
import { SHORTCUT_GROUPS } from "../data/settingsDefaults.ts";
import type { LanguageCode } from "../types/settings.ts";
import { LEGAL_DOCS_EN } from "./legalDocsEn.ts";

const SHORTCUT_GROUPS_EN: typeof SHORTCUT_GROUPS = [
  {
    group: "Global & Navigation",
    items: [
      { keys: ["Ctrl", "K"], desc: "Open command palette / search mail" },
      { keys: ["Ctrl", "N"], desc: "Compose new email" },
      { keys: ["Ctrl", "R"], desc: "Sync all accounts now" },
      { keys: ["Ctrl", "Shift", "T"], desc: "Toggle light / dark theme" },
      { keys: ["Ctrl", ","], desc: "Open settings" },
      { keys: ["G", "I"], desc: "Go to Unified Inbox" },
      { keys: ["G", "L"], desc: "Go to Snoozed" },
      { keys: ["G", "D"], desc: "Go to Drafts" },
    ],
  },
  {
    group: "Reading & Triage",
    items: [
      { keys: ["J", "/", "K"], desc: "Select next / previous email" },
      {
        keys: ["R"],
        desc: "Reply to email (locked to original recipient account)",
      },
      { keys: ["F"], desc: "Forward email" },
      { keys: ["E"], desc: "Archive email" },
      { keys: ["S"], desc: "Star / unstar email" },
      { keys: ["H"], desc: "Snooze email" },
      { keys: ["L"], desc: "Manage labels" },
      { keys: ["Delete"], desc: "Move to Trash" },
    ],
  },
  {
    group: "Compose & Omni AI",
    items: [
      { keys: ["Ctrl", "Enter"], desc: "Send email / Quick Reply" },
      { keys: ["Esc"], desc: "Close dialog or minimize draft" },
      { keys: ["Alt", "A"], desc: "Show or hide Omni AI panel" },
    ],
  },
];

export function getShortcutGroups(lang: LanguageCode) {
  return lang === "en-US" ? SHORTCUT_GROUPS_EN : SHORTCUT_GROUPS;
}

export function getLegalDoc(doc: "terms" | "privacy", lang: LanguageCode) {
  return (lang === "en-US" ? LEGAL_DOCS_EN : LEGAL_DOCS)[doc];
}
