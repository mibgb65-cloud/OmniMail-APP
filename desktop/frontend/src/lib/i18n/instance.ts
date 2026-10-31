import { createInstance, type i18n } from 'i18next';

import { isLocale } from './locale';
import { DEFAULT_LOCALE, resources, SUPPORTED_LOCALES, type Locale } from './resources';

type StaticResources = Record<Locale, Record<string, Record<string, string>>>;
let currentResources: StaticResources = resources;
const activeInstances = new Set<i18n>();
const instanceResources = new WeakMap<i18n, StaticResources>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStaticResources(value: unknown): value is StaticResources {
  if (!isRecord(value)) return false;
  return SUPPORTED_LOCALES.every((locale) => {
    const namespaces = value[locale];
    return (
      isRecord(namespaces) &&
      Object.keys(resources[locale]).every((namespace) => namespace in namespaces) &&
      Object.values(namespaces).every(
        (bundle) =>
          isRecord(bundle) && Object.values(bundle).every((text) => typeof text === 'string'),
      )
    );
  });
}

export function refreshI18nResources(instance: i18n, next: StaticResources) {
  for (const locale of SUPPORTED_LOCALES) {
    for (const [namespace, bundle] of Object.entries(next[locale])) {
      // 替换而非合并，避免已删除的文案残留；克隆保持各窗口/测试实例互不污染。
      instance.removeResourceBundle(locale, namespace);
      instance.addResourceBundle(locale, namespace, structuredClone(bundle));
    }
  }
  instanceResources.set(instance, next);
}

export function observeI18nResources(instance: i18n) {
  if (!import.meta.hot) return;
  // Provider 热替换后可能保留旧实例；只补齐过期资源，不覆盖正常实例的运行期扩展。
  if (instanceResources.get(instance) !== currentResources) {
    refreshI18nResources(instance, currentResources);
  }
  activeInstances.add(instance);
  return () => {
    activeInstances.delete(instance);
  };
}

if (import.meta.hot) {
  import.meta.hot.accept('./resources', (updated) => {
    if (!isStaticResources(updated?.resources)) return;
    currentResources = updated.resources;
    // 只更新资源，不重建 Provider 或整页刷新，以免清空正在填写的账号/撰写信息。
    activeInstances.forEach((instance) => refreshI18nResources(instance, currentResources));
  });
  import.meta.hot.dispose(() => activeInstances.clear());
}

export function createI18nInstance(locale: Locale) {
  const instance = createInstance();
  // 静态资源同步初始化，不注册网络加载器或全局实例，确保离线首屏和多窗口隔离。
  void instance.init({
    lng: isLocale(locale) ? locale : DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    load: 'currentOnly',
    ns: Object.keys(currentResources[DEFAULT_LOCALE]),
    defaultNS: 'common',
    resources: structuredClone(currentResources),
    initAsync: false,
    returnNull: false,
    returnEmptyString: false,
    // 仅通过 React 文本节点渲染，避免重复转义；不允许将翻译交给 innerHTML。
    interpolation: { escapeValue: false },
    react: { useSuspense: false, bindI18nStore: 'added removed' },
  });
  instanceResources.set(instance, currentResources);
  return instance;
}
