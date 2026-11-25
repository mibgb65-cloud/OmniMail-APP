import type {
  muse as zhMuse,
  museErrors as zhMuseErrors,
} from "../zh/museMail.ts";

export const muse = {
  providerName: "Muse Mail",
  providerDomain: "muse.ai",
  addModalCardSub: "@muse.ai · Isolated web sign-in",
  addModalCardBadge: "Web Sign-In",
  connectHeading: "Connect Muse Mail",
  summaryPill: "Isolated web sign-in · Client access only",
  prepStep1:
    "Confirm you already have a Meta Muse account with an active @muse.ai mailbox.",
  prepStep2:
    "Click “Open Muse Sign-In Window” on the right to complete official sign-in and 2FA.",
  prepStep3:
    "Return here to verify the connection and confirm the detected @muse.ai address.",
  prepFootnote:
    "Completed entirely on official sign-in pages — OmniMail never autofills passwords.",
  webLoginFieldLabel: "Official Web Sign-In",
  loginCardTitle: "Dedicated Sign-In Window",
  loginStageIdle: "Not signed in",
  loginStageOpen: "Signing in",
  loginStageDone: "Signed in",
  loginCardDesc:
    "Authenticate on muse.ai in an isolated window — no manual cookie copying",
  openLoginWindowBtn: "Open Muse Sign-In Window",
  reopenLoginWindowBtn: "Reopen Sign-In Window",
  verifiedEmailLabel: "Verified Email Address",
  verifiedEmailPlaceholder:
    "Your verified @muse.ai address appears here after verification",
  sessionVerifiedPill: "Session verified",
  accountNameLabel: "Account Name",
  accountNamePlaceholder: "e.g. Muse Personal",
  connectionModeLabel: "Connection Mode",
  connectionModeValue:
    "Built-in native gateway (automatic handshake · read-only mail)",
  infoBannerTitle:
    "OmniMail verifies the @muse.ai mailbox bound to this sign-in session",
  infoBannerDesc:
    "Once confirmed, browse conversations in OmniMail and disconnect anytime in Settings.",
  footerNote:
    "Provider sign-in and security steps may change — refer to official documentation.",
  verifyAndConnectBtn: "Verify & Connect",
  verifyingBtn: "Verifying session…",
  confirmBindBtn: "Confirm & Open",
  bindingSuccessBtn: "Connected",
  verifyRetryBtn: "Retry Verification",
  verifiedReadyHint:
    "Verified {email}. Review the address and click below to finish binding.",
  sidebarSectionTitle: "Muse Mail",
  sidebarEntryAria: "Open Muse Mail read-only view: {name}",
  settingsCardTitle: "Muse Mail Session",
  settingsCardSub: "{email} · In-memory read-only session in this workspace",
  openViewBtn: "Open View",
  disconnectBtn: "Disconnect",
  disconnectedToast:
    "Disconnected Muse Mail and cleared in-memory session data",
  connectedToast: "Connected Muse Mail: {email}",
  topVerifiedPill: "Verified mailbox",
  lastRefreshedAt: "Last refreshed: {time}",
  notRefreshedYet: "Not refreshed yet",
  manualRefreshBtn: "Refresh",
  cancelRefreshBtn: "Cancel",
  threadListHeading: "Conversations",
  threadCountLabel:
    "{count, plural, one {# conversation} other {# conversations}} loaded",
  loadMoreBtn: "Load more",
  loadingMoreBtn: "Loading more…",
  noSubjectFallback: "(No subject)",
  unknownSenderFallback: "Unknown sender",
  timeUnknown: "Unknown time",
  messageCountBadge: "{count, plural, one {# msg} other {# msgs}}",
  selectThreadHintTitle: "Select a conversation to read",
  selectThreadHintDesc:
    "Messages render as escaped plain text without loading remote resources.",
  directionInbound: "Inbound",
  directionOutbound: "Outbound",
  directionUnknown: "Unknown direction",
  serverTimeSemanticNote:
    "Timestamps reflect Muse server created_at records rather than raw MIME Date headers.",
  fromLabel: "From",
  toLabel: "To",
  ccLabel: "Cc",
  museVerdictBadge: "Provided by Muse: {verdict}",
  emptyBodyPlaceholder: "(No plain-text body in this message)",
  attachmentsMetaLabel: "Attachments (metadata only in this release)",
  stateEmptyTitle: "No conversations in this mailbox",
  stateEmptyDesc:
    "No email threads were returned for {email}. You can refresh manually anytime.",
  stateNotEnabledTitle: "@muse.ai mailbox is not enabled",
  stateNotEnabledDesc:
    "This Meta Muse account has not enabled Muse Mail yet. OmniMail will not create a mailbox automatically — enable it on muse.ai first.",
  stateAuthExpiredTitle: "Muse sign-in session expired",
  stateAuthExpiredDesc:
    "Your current session is no longer valid. Reopen the dedicated sign-in window to re-authenticate.",
  stateIdentityChangedTitle: "Bound mailbox identity changed",
  stateIdentityChangedDesc:
    "The active sign-in session resolved to a different @muse.ai address. Previous content was cleared — please verify and confirm again.",
  stateGatewayErrorTitle: "Unable to reach Muse Mail service",
  stateGatewayErrorDesc: "{message}",
  errorCodeLabel: "Code: {code}",
  retryBtn: "Retry",
  reverifyBtn: "Verify Again",
  backToMailBtn: "Back to Mail",
  stateClearedTitle: "No active Muse session in this workspace",
  stateClearedDesc:
    "Temporary sessions and in-memory messages are cleared automatically when switching workspaces, locking, or disconnecting.",
  connectMuseBtn: "Connect Muse Mail",
} satisfies typeof zhMuse;

export const museErrors = {
  ERR_MUSE_NOT_LOGGED_IN:
    "No active Muse sign-in session detected — complete sign-in in the dedicated window first",
  ERR_MUSE_AUTH_EXPIRED:
    "Muse sign-in session has expired — reopen the sign-in window to verify again",
  ERR_MUSE_NOT_ENABLED:
    "This Meta Muse account has not enabled @muse.ai mail service yet",
  ERR_MUSE_IDENTITY_CHANGED:
    "Detected a different @muse.ai mailbox on this session — view cleared, please re-verify",
  ERR_MUSE_GATEWAY_TIMEOUT:
    "Timed out waiting for Muse Mail service — check your network and retry",
  ERR_MUSE_GATEWAY_FAILED:
    "Muse Mail gateway communication failed — please retry shortly",
  ERR_MUSE_UNSUPPORTED:
    "Isolated WebView2 sign-in is unavailable in this environment",
  ERR_MUSE_CANCELLED: "Cancelled active Muse Mail request",
} satisfies typeof zhMuseErrors;
