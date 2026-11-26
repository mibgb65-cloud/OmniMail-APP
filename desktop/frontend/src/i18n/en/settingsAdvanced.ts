import type { settingsAdvanced as zhSettingsAdvanced } from "../zh/settingsAdvanced.ts";

export const settingsAdvanced = {
  aiModeDisabled: "Disabled",
  aiModeAutoSummarize: "Auto-summarize on open",
  aiModeOnDemand: "On demand",
  aiPrivacySection: "Omni AI Privacy Boundaries & Controls",
  aiEnableTitle: "Enable Omni AI Assistant",
  aiEnableDesc:
    "When disabled, no summaries or suggestions run — pure local mail client mode",
  aiAutoSummarizeTitle: "Auto-summarize on open",
  aiAutoSummarizeDesc:
    "Summarizes unopened insights once and caches locally; sensitive/OTP emails are skipped; reply drafts remain manual",
  aiAutoSummarizeFootnote:
    "Active only while the Omni AI panel is open. Uses your configured model without per-email confirmation.",
  aiConfirmEachTimeTitle: "Confirm data scope before each explicit action",
  aiConfirmEachTimeDesc:
    "Previews whether body, optional subject, and chat turns will be sent before proceeding",
  aiIncludeSubjectTitle: "Allow sending current email subject (off by default)",
  aiIncludeSubjectDesc:
    "When off, only message body is used. Attachments, filenames, and file previews are never shared.",
  aiSavePrivacyFailed: "Unable to save AI privacy settings — please retry",
  aiByokSection: "BYOK Model Endpoint & Encrypted Key",
  aiBadgeModelsLoaded:
    "Official API · {count, plural, one {# model} other {# models}} loaded",
  aiBadgePendingFetch: "Official API · Fetch models",
  aiBadgePendingKey: "Key required",
  aiBadgeLocalOllama: "Local service",
  aiBadgeCustomGateway: "Self-hosted / Gateway",
  aiFooterPresetHint:
    "No Base URL needed; switch to “Custom Service” for proxies or self-hosted gateways.",
  aiFooterOllamaHint:
    "Make sure Ollama is running with models pulled. API key is optional locally.",
  aiFooterCustomHint:
    "Compatible with OneAPI, vLLM, LM Studio, and OpenAI-compatible gateways.",
  aiProviderLabel: "Provider",
  aiProviderPresetDesc:
    "Uses the official endpoint automatically — enter your API key to fetch models.",
  aiProviderCustomDesc:
    "Enter your endpoint URL and type a model ID or fetch available models.",
  aiProviderSelectAria: "AI provider",
  aiProviderOllamaLabel: "Ollama (Local)",
  aiProviderCustomLabel: "Custom Service (OpenAI-compatible)",
  aiProviderOfficialHint: "Official",
  aiFetchModelsPreset: "Fetch models",
  aiFetchModelsCustom: "Fetch models",
  aiFetchingModels: "Fetching…",
  aiNoModelsFound: "No models found",
  aiFetchModelsFirst: "Fetch models first",
  aiChooseModel: "Model",
  aiModelName: "Model ID",
  aiCustomBaseUrlLabel: "Custom Base URL",
  aiCustomBaseUrlRequired: " (Required)",
  aiHttpsRequiredHint:
    "HTTPS is required when sending API keys to remote hosts.",
  aiApiKeyLabel: "API Key ({optional}DPAPI encrypted · Current: {mask})",
  aiOptionalPrefix: "Optional · ",
  aiNotSet: "Not set",
  aiOfficialEndpointPrefix: "Official host: {host}",
  aiApiKeyAria: "AI API key",
  aiApiKeyPresetPlaceholder:
    "Enter {provider} API Key (leave blank to keep saved key)",
  aiApiKeyCustomPlaceholder: "Optional for local passwordless gateways",
  aiClearSavedKey: "Clear saved key",
  aiModelsLoadedDesc:
    "Loaded {count, plural, one {# model} other {# models}} via {provider} API Key",
  aiNoModelsReturnedDesc:
    "No models returned by the endpoint — check account permissions",
  aiKeyReadyFetchDesc: "Key ready — click “Fetch models” to select",
  aiEnterKeyFirstDesc: "Enter an API key and click “Fetch models”",
  aiSearchModelLabel: "Search models",
  aiManualModelLabel: "{label} (manual entry supported)",
  aiManualModelPlaceholder: "e.g. qwen2.5:7b",
  aiPickFetchedModel: "Select from fetched models",
  aiNoModelsManualHint: "No models discovered — enter a model ID manually.",
  aiTestConnIdle: "Test connection",
  aiTestConnLoading: "Testing…",
  aiSaveConfigIdle: "Save config",
  aiSaveConfigLoading: "Encrypting & saving…",
  aiConfigSavedMsg: "AI configuration saved",
  aiKeyClearedMsg: "Saved encrypted API key cleared",
  transEnableTitle: "Enable Mail Translation",
  transEnableDesc:
    "Translate the open email on demand while preserving tables, buttons, and layout.",
  transSaveFailed: "Unable to save translation settings — please retry.",
  transDefaultTargetTitle: "Target language",
  transDefaultTargetDesc:
    "Default target language when translating emails, with quick search across 12 languages",
  transSearchLangLabel: "Search languages…",
  transLayoutBehaviorSection: "Layout Fidelity & Display Behavior",
  transDefaultModeTitle: "Display mode",
  transDefaultModeDesc:
    "Choose whether translated emails default to inline replacement or bilingual view",
  transModeInlineLabel: "Inline replace",
  transModeInlineSub: "Replaces original paragraph text in place",
  transModeBilingualLabel: "Bilingual",
  transModeBilingualSub:
    "Shows translated text right below each original block",
  transSyncSubjectTitle: "Translate subject",
  transSyncSubjectDesc:
    "When off, only message body is translated. Adjustable per email in Translation options.",
  transPrivacyCacheSection: "Session Cache & Privacy Boundary",
  transPrivacyCacheDesc:
    "Only visible body text and optional subject are sent after clicking Translate; headers, images, and attachments stay local. Cached in memory for the current session.",
  transEngineSection: "Translation Engine & Endpoint",
  transBilibiliFreeOption: "Bilibili Free Translate (Recommended)",
  transNoApiKeySub: "No API Key required",
  transNoApiKeyBadge: "No API Key required",
  transAiByokOption: "AI Assistant Model (BYOK)",
  transAiByokSub: "Uses your configured AI Assistant model",
  transProviderTitle: "Translation engine",
  transProviderDesc:
    "Use the built-in free engine or reuse your configured AI Assistant model",
  transUsingAiHint: "Using the model configured in AI Assistant.",
  transNeedAiHint: "Enable and configure an AI model first.",
  transConfigureModelBtn: "Configure AI",
  transEndpointUrl: "Endpoint URL",
  transResetDefaultEndpoint: "Reset default endpoint",
  transEndpointNotePrefix:
    "Default preset connects directly to official endpoint ",
  transEndpointNoteSuffix:
    ". Custom endpoints must match this schema with no fallback; HTTPS recommended.",
  transTimeoutLabel: "Request timeout & retry",
  transTimeoutAria: "Request timeout (seconds)",
  transTimeoutSuffix: "sec · Auto-retries once",
  transSaveEngineBtn: "Save endpoint",
  transTestConnection: "Test connection",
  transTestingConnection: "Testing…",
  transConnOkLatency: "Connected · {ms} ms",
  privacySection: "Reading Privacy & Anti-Phishing",
  privacyBlockRemoteTitle: "Block remote images & tracking pixels by default",
  privacyBlockRemoteDesc:
    "When off, remote images load automatically except on high-risk phishing mail",
  privacyPhishingTitle: "Enable SPF / DKIM / DMARC phishing verification",
  privacyPhishingDesc:
    "Displays security banners on spoofed domains or suspicious links and blocks AI access",
  privacyEncryptionTitle: "Encrypt local cache & credential vault",
  privacyEncryptionDesc:
    "Protects message index and OAuth / app-password tokens with per-user OS keys",
  privacySaveImageFailed: "Unable to save remote image policy",
  privacyWipeTitle: "Wipe all local data & reset app",
  privacyWipeDesc:
    "Irreversibly clears local cache, rules, contacts, and account configs (server mail untouched)",
  privacyWipeBtn: "Wipe local data",
  storageDirTitle: "Local Data Directory",
  storageBootstrapSub: "Bootstrap: {path} · Disk free {free}",
  storageOpenDirBtn: "Open folder",
  storageMigrateDirBtn: "Migrate directory",
  storageCasTitle: "Local SQLite & CAS Cache Breakdown",
  storageBreakdownSub:
    "SQLite {db} · Raw mail {raw} · Attachment cache {attachments}",
  storageFallbackSub:
    "Includes SQLite index, message bodies, attachment cache, and FTS5 index",
  storageClearCacheBtn: "Clear attachment cache",
  storageQuotaTitle: "Attachment offline cache limit (LRU eviction)",
  storageQuotaDesc:
    "Automatically evicts least-recently-used large attachments above limit",
  storageQuotaAria: "Attachment offline cache limit",
  storageBackupTitle: "Backup Export & .mbox Archive",
  storageBackupDesc:
    "Export full workspace .zip snapshot or batch-export Inbox as standard .mbox",
  storageOpenBackupBtn: "Backup & Export",
  aboutBetaBadge: "Beta",
  aboutStableBadge: "Stable",
  aboutVersionRow:
    "Version {version}{builtAt} · Wails v3 + Go + React + TypeScript",
  aboutBuiltAtPart: " · Built {time}",
  aboutCheckUpdatesBtn: "Check for updates",
  aboutSummary:
    "Local-first multi-account desktop email workspace with light/dark themes, sender identity lock, and privacy-clear Omni AI.",
  aboutViewTermsBtn: "Terms of Service (Draft)",
  aboutViewPrivacyBtn: "Privacy Policy (Draft)",
  aboutExportDiagBtn: "Export redacted diagnostics",
} satisfies typeof zhSettingsAdvanced;
