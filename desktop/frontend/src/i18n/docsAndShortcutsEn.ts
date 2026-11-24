import { LEGAL_DOCS, SHORTCUT_GROUPS } from "../data/settingsDefaults.ts";
import type { LanguageCode } from "../types/settings.ts";

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

const LEGAL_DOCS_EN: typeof LEGAL_DOCS = {
  terms: {
    title: "Terms of Service",
    badge: "Design Draft · V0.1",
    updatedAt: "Last updated: Nov 15, 2026",
    sections: [
      {
        heading: "1. Scope & Purpose",
        body: "OmniMail is a local-first desktop multi-account email workspace that connects Gmail, Outlook, QQ Mail, NetEase Mail, and standard IMAP/SMTP providers in one unified interface. This document is a UI preview draft and will be finalized prior to public release.",
      },
      {
        heading: "2. Account Authorization Boundaries",
        body: "OmniMail connects via official browser OAuth or dedicated client app passwords — web login passwords are never stored. Users remain responsible for safeguarding local OS credential vaults and app-specific passwords.",
      },
      {
        heading: "3. Irreversible Actions & Confirmation",
        body: "Emptying Trash, permanently deleting messages, removing account configs, and wiping local workspace data are high-impact actions gated by explicit confirmation dialogs.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    badge: "Design Draft · V0.1",
    updatedAt: "Last updated: Nov 15, 2026",
    sections: [
      {
        heading: "1. Local Cache & Encrypted Storage",
        body: "Synchronized email bodies, local search indexes, contact notes, and inbox rules are stored exclusively in your encrypted local data directory and accessed only during local search, cleanup, or backup export.",
      },
      {
        heading: "2. Opt-In Omni AI & Data Boundaries",
        body: "Initializing OmniMail never activates AI automatically. Summaries and reply drafts run on demand using the current message body only — sender/recipient address lists and attachments are excluded by default, and Spam/Trash block AI access.",
      },
      {
        heading: "3. Remote Images & Anti-Tracking",
        body: "OmniMail blocks remote images and external tracking pixels by default, surfaces SPF/DKIM/DMARC verification alerts, and loads external images only when explicitly requested.",
      },
    ],
  },
};

export function getShortcutGroups(lang: LanguageCode) {
  return lang === "en-US" ? SHORTCUT_GROUPS_EN : SHORTCUT_GROUPS;
}

export function getLegalDoc(doc: "terms" | "privacy", lang: LanguageCode) {
  return (lang === "en-US" ? LEGAL_DOCS_EN : LEGAL_DOCS)[doc];
}
