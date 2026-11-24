import type { AppSettings } from "../types/settings";

export const INITIAL_SETTINGS: AppSettings = {
  theme: "light",
  themePreference: "system",
  darkHtmlMode: "adaptive",
  language: "zh-CN",
  density: "comfortable",
  fontSize: "standard",
  launchAtStartup: false,
  closeToTray: true,
  showDesktopNotifications: true,
  notificationPermission: "granted",
  syncIntervalMinutes: 5,
  offlineRetentionDays: 90,
  defaultSendAccountId: "acc-gmail",
  lockReplyToOriginalAccount: true,
  undoSendSeconds: 10,
  defaultFontFamily: "Noto Sans SC",
  autoAppendSignature: true,
  aiEnabled: true,
  translationEnabled: true,
  translationProvider: "bilibili",
  translationEndpoint: "https://api.bilibili.com/x/intl/translate/v2",
  translationTimeoutSec: 8,
  aiAutoSummarizeOnOpen: false,
  aiRequireConfirmEachTime: true,
  aiProvider: "openai",
  aiModel: "",
  aiApiKeyMasked: "",
  aiIncludeSenderAndAttachments: false,
  blockRemoteImages: true,
  phishingCheckEnabled: true,
  localEncryptionEnabled: true,
  attachmentCacheLimitGb: 2,
  autoReply: {
    enabled: false,
    accountId: "acc-gmail",
    startTime: "2026-11-18 09:00",
    endTime: "2026-11-22 18:00",
    contactsAndSameDomainOnly: true,
    limitOncePer4Days: true,
    subject: "自动回复：外出差旅期间邮件处理说明（11 月 18 日 – 11 月 22 日）",
    body: "你好，感谢来信。\n我目前于 11 月 18 日至 11 月 22 日外出差旅，期间回复邮件可能有所延迟。如有紧急版本评审或线上交付事项，请联系林知夏（zhixia@studio.example）。\n返回后我会第一时间查阅并回复你的邮件，谢谢理解！",
    repliedCount: 7,
  },
};

export const SHORTCUT_GROUPS = [
  {
    group: "全局与导航",
    items: [
      { keys: ["Ctrl", "K"], desc: "打开全局命令面板 / 搜索邮件与指令" },
      { keys: ["Ctrl", "N"], desc: "撰写新邮件" },
      { keys: ["Ctrl", "R"], desc: "立即同步全部邮箱" },
      { keys: ["Ctrl", "Shift", "T"], desc: "切换亮色 / 暗色主题" },
      { keys: ["Ctrl", ","], desc: "打开偏好设置" },
      { keys: ["G", "I"], desc: "跳转至统一收件箱" },
      { keys: ["G", "L"], desc: "跳转至稍后处理" },
      { keys: ["G", "D"], desc: "跳转至草稿箱" },
    ],
  },
  {
    group: "邮件阅读与整理",
    items: [
      { keys: ["J", "/", "K"], desc: "选择下一封 / 上一封邮件" },
      { keys: ["R"], desc: "回复当前邮件（自动锁定原收件账户）" },
      { keys: ["F"], desc: "转发当前邮件" },
      { keys: ["E"], desc: "归档当前邮件" },
      { keys: ["S"], desc: "标星 / 取消标星" },
      { keys: ["H"], desc: "设置稍后提醒" },
      { keys: ["L"], desc: "管理邮件标签" },
      { keys: ["Delete"], desc: "移入回收站" },
    ],
  },
  {
    group: "写信与 Omni AI",
    items: [
      { keys: ["Ctrl", "Enter"], desc: "立即发送邮件 / 快速回复" },
      { keys: ["Esc"], desc: "关闭当前弹窗或最小化写信草稿" },
      { keys: ["Alt", "A"], desc: "展开或收起右侧 Omni AI 面板" },
    ],
  },
];

export const LEGAL_DOCS = {
  terms: {
    title: "用户协议",
    badge: "界面设计草案 · V0.1",
    updatedAt: "草案修订日期：2026-11-15",
    sections: [
      {
        heading: "1. 服务范围与定位",
        body: "OmniMail 是一款本地优先的桌面多邮箱工作空间，帮助用户在同一界面内连接并整理来自 Gmail、Outlook、QQ 邮箱、网易邮箱及标准 IMAP/SMTP 服务的邮件。当前文档仅作界面设计预览草案，正式版本发布前须经法务审核并补齐运营主体信息。",
      },
      {
        heading: "2. 账户接入与授权边界",
        body: "用户连接外部邮箱时优先采用官方浏览器 OAuth 授权或客户端专用授权码，OmniMail 不留存邮箱网页登录密码。用户应妥善管理本机系统凭据库与应用专用密码。",
      },
      {
        heading: "3. 不可逆操作与用户确认",
        body: "清空回收站、永久删除邮件、移除本地邮箱配置及清除全部本地数据均属于高风险操作，界面将提供二次确认提示，请用户在执行前核对影响范围。",
      },
    ],
  },
  privacy: {
    title: "隐私政策",
    badge: "界面设计草案 · V0.1",
    updatedAt: "草案修订日期：2026-11-15",
    sections: [
      {
        heading: "1. 本地缓存与加密存储",
        body: "所有同步后的邮件正文、本地搜索索引、联系人备注与收件规则均默认保存在用户本机加密数据目录，仅在用户主动触发清理或备份迁移时读写。",
      },
      {
        heading: "2. Omni AI 独立选择与外传边界",
        body: "首次启用应用并不等同于开启 AI 服务。AI 摘要与起草默认需用户主动触发，仅使用当前选定邮件正文，默认不向外部模型发送发件人地址列表与附件内容，垃圾邮件与回收站默认禁用 AI 读取。",
      },
      {
        heading: "3. 远程图片与追踪防护",
        body: "OmniMail 默认拦截陌生发件人邮件中的远程图片与外部追踪像素，并提供 SPF/DKIM/DMARC 异常提醒，仅在用户明确点击加载后显示远程图片。",
      },
    ],
  },
};
