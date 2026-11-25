import type { ProviderCatalogItem, ProviderId } from "../types/account.ts";

export type ProviderLocaleCopy = Pick<
  ProviderCatalogItem,
  | "name"
  | "subtitle"
  | "domainHint"
  | "emailPlaceholder"
  | "badgeText"
  | "guideTitle"
  | "guideSummary"
  | "steps"
> & { oauthSteps?: string[]; note?: string };

export const EN_PROVIDERS_PRIMARY: Partial<
  Record<ProviderId, ProviderLocaleCopy>
> = {
  gmail: {
    name: "Gmail",
    subtitle: "Google Account · Browser OAuth",
    domainHint: "gmail.com / googlemail.com",
    emailPlaceholder: "Enter your full Gmail address",
    badgeText: "OAuth",
    guideTitle: "Gmail · Browser OAuth",
    guideSummary:
      "Sign in via Google in your default browser without storing your web password.",
    steps: [
      "Enable 2-Step Verification on Google and confirm IMAP access in Gmail.",
      "Generate a 16-character App Password in Google Account Security (spaces stripped automatically).",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
    oauthSteps: [
      "Open the official Google authorization page in your default browser.",
      "Choose your Google account and grant mail sync permissions.",
      "Return to OmniMail automatically via local callback to start initial sync.",
    ],
  },
  outlook: {
    name: "Outlook",
    subtitle: "Microsoft 365 / Hotmail · Browser OAuth",
    domainHint: "outlook.com / hotmail.com / Microsoft 365",
    emailPlaceholder: "Enter your full Outlook or Hotmail address",
    badgeText: "OAuth",
    guideTitle: "Outlook · Browser OAuth 2.0",
    guideSummary:
      "Sign in with PKCE on Microsoft's official portal without exposing your password.",
    steps: [
      "Confirm IMAP/SMTP client access is enabled on your Microsoft / Outlook account.",
      "Generate an App Password in Microsoft Security — do not enter your web password.",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
    oauthSteps: [
      "Sign in to Microsoft / Outlook in your default browser and confirm mail scopes.",
      "Or switch to an App Password if enabled on your organization or personal account.",
      "Tokens are encrypted directly into your local workspace vault.",
    ],
  },
  qq: {
    name: "QQ Mail",
    subtitle: "QQ / Foxmail · IMAP & Authorization Code",
    domainHint: "qq.com / foxmail.com",
    emailPlaceholder: "Enter your full QQ or Foxmail address",
    badgeText: "Auth Code",
    guideTitle: "QQ Mail · Authorization Code",
    guideSummary:
      "QQ Mail requires a 16-character IMAP/SMTP authorization code instead of your QQ password.",
    steps: [
      "Open QQ Mail web settings and enable IMAP / SMTP client service.",
      "Generate a 16-character authorization code; do not enter your QQ login password.",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
  },
  netease: {
    name: "NetEase Mail",
    subtitle: "163.com / 126.com · Auto-matched by domain",
    domainHint: "163.com / 126.com",
    emailPlaceholder: "name@163.com or name@126.com",
    badgeText: "163 / 126",
    guideTitle: "NetEase Mail (163 / 126) · Auth Code",
    guideSummary:
      "Automatically matches IMAP/SMTP hosts for @163.com, @126.com, or @yeah.net.",
    steps: [
      "Enable IMAP / SMTP service in NetEase Mail web client settings.",
      "Create a client authorization code; 163 and 126 hosts auto-match by domain suffix.",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
  },
  linuxdo: {
    name: "Linux Do Mail",
    subtitle: "linux.do · Dedicated Client Token",
    domainHint: "linux.do",
    emailPlaceholder: "Enter your full Linux Do email address",
    badgeText: "Token",
    guideTitle: "Linux Do · Dedicated Client Token",
    guideSummary:
      "Connect over TLS using a client access token issued from the community mail portal.",
    steps: [
      "Confirm you have active Linux Do mail access rather than a forum-only account.",
      "Generate a dedicated mail client access token on the official token page.",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
  },
};
