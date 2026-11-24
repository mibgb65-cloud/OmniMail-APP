import { t as globalT, type TranslationKey } from "../../i18n";
import type { SettingsTabId } from "../../types/settings";
import type { IconName } from "../common/Icon";

export interface SettingsNavItem {
  id: SettingsTabId;
  label: string;
  icon: IconName;
}

export function getSettingsNav(
  translate: (key: TranslationKey) => string = globalT,
): SettingsNavItem[] {
  return [
    { id: "general", label: translate("settings.navGeneral"), icon: "sliders" },
    { id: "accounts", label: translate("settings.navAccounts"), icon: "mail" },
    { id: "sync", label: translate("settings.navSync"), icon: "refresh" },
    { id: "compose", label: translate("settings.navCompose"), icon: "pencil" },
    { id: "rules", label: translate("settings.navRules"), icon: "rule" },
    {
      id: "auto-reply",
      label: translate("settings.navAutoReply"),
      icon: "autoReply",
    },
    { id: "ai", label: translate("settings.navAi"), icon: "sparkle" },
    {
      id: "translation",
      label: translate("settings.navTranslation"),
      icon: "language",
    },
    { id: "privacy", label: translate("settings.navPrivacy"), icon: "shield" },
    {
      id: "storage",
      label: translate("settings.navStorage"),
      icon: "database",
    },
    {
      id: "shortcuts",
      label: translate("settings.navShortcuts"),
      icon: "keyboard",
    },
    { id: "about", label: translate("settings.navAbout"), icon: "info" },
  ];
}

export const settingsNav: SettingsNavItem[] = getSettingsNav();
