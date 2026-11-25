import type { ProviderCatalogItem } from "../types/account.ts";

export const PROVIDERS_AGENT: ProviderCatalogItem[] = [
  {
    id: "workbuddy",
    category: "agent",
    name: "WorkBuddy Agent 邮箱",
    subtitle: "workbuddy.cn · 腾讯智能体邮箱",
    domainHint: "workbuddy.cn / mail.workbuddy.cn",
    officialGuideUrl: "https://www.workbuddy.cn",
    badgeText: "官方授权",
    badgeTone: "blue",
    authMode: "oauth",
    officialIcon: true,
    guideTitle: "连接 WorkBuddy 邮箱",
    guideSummary:
      "通过系统默认浏览器完成腾讯 WorkBuddy 官方授权并识别智能体邮箱别名。",
    steps: [
      "确认你的腾讯 WorkBuddy 账号已开通智能体邮箱服务。",
      "点击右侧「前往浏览器授权」，在官方页面完成账号登录并确认授权。",
      "授权通过后将自动识别绑定的智能体邮箱地址，确认即可开始查阅邮件。",
    ],
    defaultImapHost: "",
    defaultImapPort: 0,
    defaultSmtpHost: "",
    defaultSmtpPort: 0,
  },
  {
    id: "muse",
    category: "agent",
    name: "Muse Mail",
    subtitle: "muse.ai · 智能体专属邮箱",
    domainHint: "muse.ai",
    officialGuideUrl: "https://www.meta.com/help/",
    badgeText: "原生直连",
    badgeTone: "blue",
    authMode: "token",
    officialIcon: true,
    guideTitle: "连接 Muse Mail",
    guideSummary:
      "通过独立隔离登录窗口完成官方认证并经内置原生加密网关只读查看邮件。",
    steps: [
      "确认你的账户已开通可用的 @muse.ai 专属邮箱身份。",
      "点击右侧「打开 Muse 登录窗口」，在官方页面完成账号验证。",
      "点击「验证并连接」自动核验绑定身份，即可在工作台查阅会话。",
    ],
    defaultImapHost: "",
    defaultImapPort: 0,
    defaultSmtpHost: "",
    defaultSmtpPort: 0,
  },
];
