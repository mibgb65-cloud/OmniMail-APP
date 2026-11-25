import type { providerConnect as zhProviderConnect } from "../zh/providerConnect.ts";

export const providerConnect = {
  connectHeading: "Connect {provider}",
  connectBadgeExisting: "Existing account",
  connectSubtitleUnified:
    "Client access for an existing mailbox · Never registers third-party accounts",
  summaryTlsPill: "TLS Secured · Client access only",
  summaryOAuthPill: "OAuth 2.0 · Client access only",
  prepCardTitle: "Prepare first, then connect",
  prepCardBadge: "3-step guide",
  viewOfficialGuideBtn: "View official setup guide",
  noAutoRedirectHint: "Never auto-redirects or autofills third-party logins.",
  accountNameLabel: "Account name",
  accountNamePlaceholder: "e.g. Work Mail",
  secretLabelAuthCode: "Client authorization code",
  secretLabelAppPassword: "App-specific password",
  secretLabelClientToken: "Dedicated client token",
  localEncryptedPill: "Local encrypted",
  secretInputPlaceholder:
    "Entered locally and encrypted — never shown in previews",
  serverConfigLabel: "Server configuration",
  serverConfigToggle:
    "Use recommended {provider} settings (IMAP/SMTP TLS) · Expand to verify",
  imapHostFieldLabel: "IMAP host",
  smtpHostFieldLabel: "SMTP host",
  infoBannerTitle: "Verifies incoming & outgoing mail before connecting",
  infoBannerDesc:
    "Dedicated credentials are used solely for your chosen mailbox, encrypted in your local vault, and removable anytime in Settings.",
  footerSafetyNote:
    "Provider security settings may change — refer to official documentation.",
  backToSourceBtn: "Back to sources",
  testAndConnectBtn: "Test & connect",
  manualSummaryName: "Standard IMAP / SMTP",
  manualSummaryDomains: "Enterprise / Self-hosted / Standard Mail",
  manualPrepStep1:
    "Confirm IMAP / SMTP hostnames, port numbers, and encryption mode with your mail administrator.",
  manualPrepStep2:
    "Prepare your mailbox or app password; self-signed intranet certificates can be pinned after probing.",
  manualPrepStep3:
    "Fill in account and server details on the right, then verify incoming and outgoing mail.",
  manualFooterHint:
    "Standard protocol settings are provided by your organization or mail host.",
  oauthBrowserCardTitle: "Browser OAuth Sign-In",
  oauthStepBrowserLabel: "1. Open official authorization page in browser",
  oauthStepConsentLabel: "2. Confirm mail sync & offline permissions",
  oauthStepCallbackLabel: "3. Encrypt token into local vault via callback",
  oauthStatusReady: "Opened",
  oauthStatusPending: "Awaiting consent",
  oauthFallbackHint:
    "If browser callback is blocked or no OAuth Client ID is configured, switch to a 16-character App Password anytime.",
} satisfies typeof zhProviderConnect;
