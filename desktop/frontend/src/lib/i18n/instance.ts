import { createInstance } from 'i18next';

import { isLocale } from './locale';
import { DEFAULT_LOCALE, resources, SUPPORTED_LOCALES, type Locale } from './resources';

export function createI18nInstance(locale: Locale) {
  const instance = createInstance();
  // 静态资源同步初始化，不注册网络加载器或全局实例，确保离线首屏和多窗口隔离。
  void instance.init({
    lng: isLocale(locale) ? locale : DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    load: 'currentOnly',
    ns: Object.keys(resources[DEFAULT_LOCALE]),
    defaultNS: 'common',
    resources: structuredClone(resources),
    initAsync: false,
    returnNull: false,
    returnEmptyString: false,
    // 仅通过 React 文本节点渲染，避免重复转义；不允许将翻译交给 innerHTML。
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}
