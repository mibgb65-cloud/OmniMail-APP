import zhCommon from '../../locales/zh-CN/common.json';
import zhConnection from '../../locales/zh-CN/connection.json';
import zhNavigation from '../../locales/zh-CN/navigation.json';
import zhWorkspace from '../../locales/zh-CN/workspace.json';
import zhSettings from '../../locales/zh-CN/settings.json';
import zhMessages from '../../locales/zh-CN/messages.json';
import enCommon from '../../locales/en/common.json';
import enConnection from '../../locales/en/connection.json';
import enNavigation from '../../locales/en/navigation.json';
import enWorkspace from '../../locales/en/workspace.json';
import enSettings from '../../locales/en/settings.json';
import enMessages from '../../locales/en/messages.json';

const chinese = {
  common: zhCommon,
  navigation: zhNavigation,
  workspace: zhWorkspace,
  connection: zhConnection,
  settings: zhSettings,
  messages: zhMessages,
};

export type Translations = typeof chinese;
export type Namespace = keyof Translations;

// 中文定义键结构；其他语言缺键或多键时由类型检查和语言包测试共同拦截。
export const resources = {
  'zh-CN': chinese,
  en: {
    common: enCommon,
    navigation: enNavigation,
    workspace: enWorkspace,
    connection: enConnection,
    settings: enSettings,
    messages: enMessages,
  } satisfies Translations,
};

export type Locale = keyof typeof resources;
export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const satisfies readonly Locale[];
export const DEFAULT_LOCALE: Locale = 'zh-CN';
