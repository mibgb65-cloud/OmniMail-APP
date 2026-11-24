import type { externalLink as zhExternalLink } from "../zh/externalLink.ts";

export const externalLink = {
  normalTitle: "Opening external website",
  normalSubtitle:
    "You are leaving OmniMail to open this address in your default browser",
  httpsBadge: "HTTPS",
  httpBadge: "Insecure HTTP",
  ipBadge: "Direct IP",
  warningNoticeHttp:
    "This link uses unencrypted HTTP; traffic may be intercepted or altered.",
  warningNoticeIp:
    "This link points directly to an IP address rather than a domain name.",
  warningNoticeHttpIp:
    "This link opens an IP address over unencrypted HTTP — verify before continuing.",
  trustDomainLabel: "Trust {hostname} and skip confirmation next time",
  copyLinkBtn: "Copy link",
  cancelBtn: "Cancel",
  continueBtn: "Continue",
  copiedToast: "Link copied to clipboard",
  copyFailedToast: "Unable to copy link",
  dangerTitleSpoofed: "Warning: Displayed link does not match destination",
  dangerSubtitleSpoofed:
    "This link may be disguising a phishing site — avoid entering credentials",
  dangerTitlePunycode: "Warning: Suspicious Punycode domain detected",
  dangerSubtitlePunycode:
    "This domain uses Punycode encoding often abused to spoof trusted sites",
  dangerTitleMailDanger: "Warning: Link from a high-risk phishing email",
  dangerSubtitleMailDanger:
    "Sender authentication failed — opening links here may compromise your account",
  shownTextLabel: "Text shown in email",
  actualDomainLabel: "Actual destination domain",
  insecureHttpSuffix: " (Insecure HTTP)",
  reasonSpoofed: "Displayed domain mismatches destination",
  reasonPunycode: "Contains Punycode lookalike domain",
  reasonMailDanger: "Email flagged for high-risk phishing",
  reasonIpAddress: "Direct IP address",
  reasonInsecureHttp: "Unencrypted HTTP connection",
  riskProceedBtn: "I understand the risk, continue",
  safeBackBtn: "Cancel & go back",
  settingsTitle: "Trusted external link domains",
  settingsCountDesc:
    "{count, plural, one {# trusted external domain} other {# trusted external domains}} — HTTPS links open directly",
  settingsEmptyDesc:
    "No trusted domains yet — external links in emails always ask before opening",
  settingsClearBtn: "Clear trusted list",
  settingsClearedToast:
    "Cleared trusted external link domains for this profile",
} satisfies typeof zhExternalLink;
