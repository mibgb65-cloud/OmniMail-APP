import type { SettingsTabId } from "../../types/settings";
import type { IconName } from "../common/Icon";

export const settingsNav: Array<{
  id: SettingsTabId;
  label: string;
  icon: IconName;
}> = [
  { id: "general", label: "通用", icon: "sliders" },
  { id: "accounts", label: "邮箱账户", icon: "mail" },
  { id: "sync", label: "收信与同步", icon: "refresh" },
  { id: "compose", label: "写信与签名", icon: "pencil" },
  { id: "rules", label: "收件规则", icon: "rule" },
  { id: "auto-reply", label: "自动回复", icon: "autoReply" },
  { id: "ai", label: "AI 助手", icon: "sparkle" },
  { id: "translation", label: "邮件翻译", icon: "language" },
  { id: "privacy", label: "隐私与安全", icon: "shield" },
  { id: "storage", label: "存储与数据", icon: "database" },
  { id: "shortcuts", label: "快捷键", icon: "keyboard" },
  { id: "about", label: "关于 OmniMail", icon: "info" },
];
