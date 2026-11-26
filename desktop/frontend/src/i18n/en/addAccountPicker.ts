import type { addAccountPicker as zhPicker } from "../zh/addAccountPicker.ts";

export const addAccountPicker: typeof zhPicker = {
  pickerPresetBadge: "{count} Presets · Auto MX Detection",
  pickerSubtitle:
    "Choose your email provider · Credentials encrypted locally via DPAPI in this workspace",
  pickerFooterNote:
    "Smooth same-frame transition with customizable sidebar display names.",
  pickerManualBtn: "Manual IMAP / SMTP",

  pickerCategoryHeading: "Categories",
  pickerCatAll: "All Providers",
  pickerCatAgent: "AI Agent Mail",
  pickerCatStandard: "Personal & Standard",
  pickerCatEnterprise: "Enterprise Mail",

  pickerAuthModesHeading: "Supported Auth",
  pickerModeOAuth: "OAuth 2.0",
  pickerModeAuthCode: "Client App Password",
  pickerModeMxProbe: "MX Auto-Detect",
  pickerModeAgentGateway: "Native Agent Gateway",

  pickerManualCardTitle: "Manual IMAP / SMTP",
  pickerManualCardSub: "Self-hosted / Coremail / Huawei Cloud · Custom naming",
  pickerVaultFootnote:
    "All tokens stay encrypted in local secrets.vault and never touch disk in plaintext.",

  pickerSearchPlaceholder:
    "Search enterprise mail, custom domain, provider, or host…",
  pickerSearchAria: "Search mail providers",
  pickerClearSearchAria: "Clear search query",
  pickerSummaryCount: "{category} · {count} built-in presets",

  pickerGroupAgentHint: "Built-in native protocol · Zero external CLI",
  pickerGroupStandardHint: "Full IMAP / SMTP sync with concise labels",
  pickerGroupEnterpriseHint:
    "Auto-matches custom enterprise domains via MX with custom naming",

  pickerCustomCardTitle: "Custom Mailbox",
  pickerCustomCardSub: "Configure IMAP / SMTP host and ports manually",
  pickerCustomCardBadge: "Standard",

  pickerEnterpriseOAuthTitle: "Microsoft 365 & Google Workspace Enterprise",
  pickerEnterpriseOAuthSub:
    "Supports custom domain OAuth 2.0 modern auth directly via your system browser.",
  pickerEnterpriseM365Btn: "Microsoft 365",
  pickerEnterpriseGwsBtn: "Google Workspace",
  pickerEnterpriseManualTitle:
    "Self-Hosted / Coremail / Huawei Cloud / Other Enterprise",
  pickerEnterpriseManualSub:
    "Auto-probes MX & DNS SRV, supports custom sidebar names and TLS cert pinning",
  pickerEnterpriseManualBtn: "Configure",

  pickerEmptyTitle: "No Matching Providers",
  pickerEmptyDesc:
    "Try a different keyword, or configure IMAP / SMTP server settings manually.",
  pickerClearSearchBtn: "Clear Search",
};
