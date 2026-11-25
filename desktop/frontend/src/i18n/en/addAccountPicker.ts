import type { addAccountPicker as zhPicker } from "../zh/addAccountPicker.ts";

export const addAccountPicker: typeof zhPicker = {
  pickerPresetBadge: "{count} Built-in Presets",
  pickerSubtitle:
    "Choose your email provider · Credentials encrypted locally via DPAPI in this workspace",
  pickerFooterNote:
    "Selecting a provider transitions smoothly inside the same frame without window resizing.",
  pickerManualBtn: "Manual IMAP / SMTP",

  pickerCategoryHeading: "Categories",
  pickerCatAll: "All Providers",
  pickerCatAgent: "AI Agent Mail",
  pickerCatStandard: "Standard & Popular Mail",

  pickerAuthModesHeading: "Supported Auth",
  pickerModeOAuth: "OAuth 2.0",
  pickerModeAuthCode: "App Password / Code",
  pickerModeAgentGateway: "Native Agent Gateway",

  pickerManualCardTitle: "Manual IMAP / SMTP",
  pickerManualCardSub: "For enterprise & self-hosted servers",
  pickerVaultFootnote:
    "All tokens stay encrypted in local secrets.vault and never touch disk in plaintext.",

  pickerSearchPlaceholder: "Search provider name, domain suffix, or auth mode…",
  pickerSearchAria: "Search mail providers",
  pickerClearSearchAria: "Clear search query",
  pickerSummaryCount: "{category} · {count} providers",

  pickerGroupAgentHint: "Built-in native protocol · Zero external CLI",
  pickerGroupStandardHint: "Full IMAP / SMTP sync & compose",

  pickerCustomCardTitle: "Custom Mailbox",
  pickerCustomCardSub: "Configure IMAP / SMTP host and ports manually",
  pickerCustomCardBadge: "Standard",

  pickerEmptyTitle: "No Matching Providers",
  pickerEmptyDesc:
    "Try a different keyword, or configure IMAP / SMTP server settings manually.",
  pickerClearSearchBtn: "Clear Search",
};
