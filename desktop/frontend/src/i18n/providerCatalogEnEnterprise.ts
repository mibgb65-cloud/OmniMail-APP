import type { ProviderId } from "../types/account.ts";
import type { ProviderLocaleCopy } from "./providerCatalogEnPrimary.ts";

export const EN_PROVIDERS_ENTERPRISE: Partial<
  Record<ProviderId, ProviderLocaleCopy>
> = {
  tencent_exmail: {
    name: "Tencent Exmail",
    subtitle: "WeCom Mail · imap.exmail.qq.com",
    domainHint:
      "Custom domain · imap.exmail.qq.com:993 · smtp.exmail.qq.com:465",
    emailPlaceholder: "name@your-company.com",
    badgeText: "App Password",
    guideTitle: "Tencent Exmail (WeCom Mail)",
    guideSummary:
      "Auto-detects custom enterprise domains via MX and connects with a client app password.",
    steps: [
      "Sign in to WeCom or exmail.qq.com and confirm IMAP / SMTP access is enabled.",
      "Generate a dedicated Client Password in Settings → Account Binding / Security Login.",
      "Customize your sidebar display name if desired (changeable anytime after saving).",
    ],
  },
  aliyun_exmail: {
    name: "Alibaba Mail",
    subtitle: "Alibaba Cloud · imap.qiye.aliyun.com",
    domainHint:
      "Custom domain · imap.qiye.aliyun.com:993 · smtp.qiye.aliyun.com:465",
    emailPlaceholder: "name@your-company.com",
    badgeText: "Security Pwd",
    guideTitle: "Alibaba Enterprise Mail",
    guideSummary:
      "Auto-detects custom domains via MX and requires a third-party client security password.",
    steps: [
      "Open Alibaba Mail web settings and navigate to Account & Security.",
      "Enable IMAP/SMTP access and generate a third-party client security password.",
      "Enter your full work email, display name, and security password to verify.",
    ],
  },
  netease_exmail: {
    name: "NetEase Exmail",
    subtitle: "East/North nodes · Built-in RFC2971 ID",
    domainHint: "imaphz.qiye.163.com / imap.qiye.163.com · Auto node routing",
    emailPlaceholder: "name@your-company.com",
    badgeText: "Auth Code",
    guideTitle: "NetEase Exmail · Auto Node & RFC2971 ID",
    guideSummary:
      "Matches East or North China nodes via MX and sends RFC2971 IMAP ID automatically.",
    steps: [
      "Open NetEase Enterprise Mail web portal and enter Settings → Client Setup.",
      "Enable IMAP / SMTP service and generate a client authorization password.",
      "Enter your work email address to auto-match regional servers and connect.",
    ],
  },
  feishu: {
    name: "Feishu / Lark",
    subtitle: "imap.feishu.cn / larksuite.com",
    domainHint: "imap.feishu.cn:993 · smtp.feishu.cn:465 (Lark supported)",
    emailPlaceholder: "name@your-company.com",
    badgeText: "App Password",
    guideTitle: "Feishu / Lark Enterprise Mail",
    guideSummary:
      "Supports automatic MX detection for Feishu (feishu.cn) and Lark (larksuite.com).",
    steps: [
      "Confirm your admin has enabled third-party IMAP / SMTP client access.",
      "Generate a dedicated client password in Feishu Mail → Third-party Client Login.",
      "Enter your full work email, sidebar display name, and dedicated password.",
    ],
  },
  mail263: {
    name: "263 Enterprise Mail",
    subtitle: "imap.263.net · SSL/TLS 993 / 465",
    domainHint: "imap.263.net:993 · smtp.263.net:465",
    emailPlaceholder: "name@your-company.com",
    badgeText: "Security Pwd",
    guideTitle: "263 Enterprise Mail · Secure Client",
    guideSummary:
      "Connects over SSL/TLS via imap.263.net:993 and smtp.263.net:465 by default.",
    steps: [
      "Sign in to 263 Enterprise Mail webmail and confirm IMAP / SMTP is enabled.",
      "Generate a client security password in Account Security settings.",
      "Enter your work email and security password, then customize the sidebar label.",
    ],
  },
  zoho_exmail: {
    name: "Zoho Workplace",
    subtitle: "imappro.zoho.com.cn / zoho.com",
    domainHint: "imappro.zoho.com.cn:993 · CN / Global / EU auto-routing",
    emailPlaceholder: "name@your-company.com",
    badgeText: "App Password",
    guideTitle: "Zoho Workplace Enterprise Mail",
    guideSummary:
      "Automatically switches between China (.com.cn), Global (.com), and EU (.eu) MX hosts.",
    steps: [
      "Open Zoho Mail Settings → Mail Accounts → IMAP Access and enable IMAP.",
      "If 2FA is active, create an Application-Specific Password in Zoho Security.",
      "Enter your work email (regional host auto-detected) and app password.",
    ],
  },
};
