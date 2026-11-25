import type {
  workbuddy as zhWB,
  workbuddyErrors as zhWBErrors,
} from "../zh/workBuddy.ts";

export const workbuddy: typeof zhWB = {
  providerName: "WorkBuddy Agent Mail",
  providerDomain: "workbuddy.cn",
  addModalCardSub: "Browser authorization · Agent mailbox",
  addModalCardBadge: "Official Auth",
  connectHeading: "Connect WorkBuddy Mail",
  summaryPill: "Browser Auth · Client Access Only",

  prepStep1:
    "Confirm Agent Mail is activated on your Tencent WorkBuddy account.",
  prepStep2:
    "Click 'Authorize in Browser' on the right to sign in and approve access on the official page.",
  prepStep3:
    "Once authorized, your bound Agent Mail address is detected automatically so you can view messages.",
  prepFootnote:
    "Provider sign-in and security steps may change; follow official documentation.",
  footerNote:
    "Tokens are encrypted locally in the active workspace vault and can be unlinked anytime in Settings.",

  authFieldLabel: "Browser Authorization",
  authCardTitle: "Tencent WorkBuddy Official Authorization",
  authStageIdle: "Not Authorized",
  authStagePolling: "Awaiting Authorization",
  authStageAuthorized: "Authorized",
  authStageNotBound: "Mailbox Not Activated",
  authCardDescIdle:
    "Open your default system browser to complete Tencent WorkBuddy sign-in without entering passwords here.",
  authCardDescPolling:
    "The official sign-in page is open in your browser. Approve access there and status will sync automatically…",
  authCardDescAuthorized:
    "Official account verified and primary Agent Mail alias detected. Ready to connect.",

  notBoundTitle: "Agent Mail Is Not Activated Yet",
  notBoundDesc:
    "Activate and bind Agent Mail in the Tencent WorkBuddy client or official portal first, then click 'Re-authorize' to sync.",
  statusDeactivatedHint:
    "This Agent Mail address is paused; existing messages remain available to read.",
  statusSuspendedHint:
    "Current Agent Mail status is {status}. Please check your WorkBuddy account portal.",

  startAuthBtn: "Authorize in Browser",
  cancelAuthBtn: "Cancel",
  reauthorizeBtn: "Re-authorize",

  detectedEmailLabel: "Detected Email Address",
  detectedEmailPlaceholder:
    "Primary alias email appears automatically after browser authorization",
  authVerifiedPill: "Auth Verified",

  accountNameLabel: "Account Name",
  accountNamePlaceholder: "e.g., WorkBuddy Agent Mail",
  defaultAccountName: "WorkBuddy Agent Mail",

  connectionModeLabel: "Connection Mode",
  connectionModeValue:
    "Native REST Gateway (HTTPS Auto-Refresh · Mail History & Attachments)",

  infoBannerTitle:
    "Token validity and Agent Mail aliases are verified before connecting",
  infoBannerDesc:
    "Tokens are encrypted locally in the active workspace vault and can be unlinked anytime in Settings.",
  infoBannerReadyDesc:
    "Detected primary alias {email}. Click 'Complete & Connect' below to browse mail records.",

  completeConnectBtn: "Complete & Connect",
  connectingBtn: "Connecting…",
  connectedBtn: "Connected",
  retryConnectBtn: "Retry Connect",
  errorCodeLabel: "Error code: {code}",

  connectedToast: "Connected WorkBuddy Mail {email}",
  disconnectedToast: "Disconnected WorkBuddy Mail {email}",

  sidebarSectionTitle: "Agent Mail",
  sidebarEntryAria: "{name} (WorkBuddy Agent Mail)",
  settingsCardSub: "{email} · Official Browser Auth",
  openViewBtn: "Open Mail",
  disconnectBtn: "Disconnect",

  inboxTab: "Inbox",
  sentTab: "Sent",
  searchPlaceholder: "Search subject, addresses, or message body…",
  clearSearchAria: "Clear search query",
  refreshBtn: "Refresh",
  refreshingBtn: "Refreshing…",
  dailyQuotaBadge: "Daily Quota {remaining}/{limit}",
  lastRefreshedAt: "Synced {time}",
  notRefreshedYet: "Click Refresh to sync latest messages",

  listCountLabel: "{count} messages",
  loadMoreBtn: "Load More",
  loadingMoreBtn: "Loading…",
  emptyInboxTitle: "No Messages in Inbox",
  emptySentTitle: "No Sent Messages",
  emptySearchTitle: "No Matching Messages",
  emptyListDesc:
    "Agent Mail records will appear here once synced. Click Refresh above to check now.",
  selectMessageTitle: "Select a Message to Read",
  selectMessageDesc:
    "Choose any message from the list on the left to read its content and save attachments.",
  noSubject: "(No subject)",
  senderLabel: "From",
  recipientsLabel: "To",
  ccLabel: "Cc",
  unreadDotAria: "Unread message",

  markReadBtn: "Mark Read",
  alreadyReadLabel: "Read",
  downloadAttachmentBtn: "Save Attachment",
  attachmentsHeading: "Attachments ({count})",
  saveAttachmentItemBtn: "Save As",
  attachmentSavedToast: "Saved attachment: {filename}",
  deleteBtn: "Delete",

  deleteModalTitle: "Delete This Message?",
  deleteModalDesc:
    "Permanently delete '{subject}' from WorkBuddy Agent Mail? This action cannot be undone.",
  confirmDeleteBtn: "Delete Permanently",
  deletingBtn: "Deleting…",
  deletedToast: "Message deleted",
};

export const workbuddyErrors: typeof zhWBErrors = {
  ERR_WB_AUTH_REQUIRED:
    "WorkBuddy session expired — please re-authorize in your browser",
  ERR_WB_AUTH_TIMEOUT:
    "Browser authorization timed out — please start authorization again",
  ERR_WB_NOT_BOUND:
    "Agent Mail is not activated on this Tencent WorkBuddy account yet",
  ERR_WB_SUSPENDED:
    "This WorkBuddy Agent Mail account is restricted or suspended",
  ERR_WB_QUOTA_EXCEEDED: "Daily Agent Mail operation quota has been reached",
  ERR_WB_RATE_LIMITED: "Too many requests — please try again shortly",
  ERR_WB_ATTACHMENT_TOO_LARGE: "Attachment exceeds the 25 MB download limit",
  ERR_WB_GATEWAY_FAILED:
    "Failed to reach WorkBuddy Mail service — please retry later",
  ERR_WB_CANCELLED: "Browser authorization was cancelled",
};
