import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { I18nextProvider, useTranslation as useI18nextTranslation } from 'react-i18next';

import { I18nContext } from './context';
import { createI18nInstance, observeI18nResources } from './instance';
import { isLocale, persistLocale, readInitialLocale, readStoredLocale } from './locale';
import { readInstallationLocale } from '../bridge/installation';
import { DEFAULT_LOCALE, type Locale } from './resources';

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [instance] = useState(() => createI18nInstance(initialLocale ?? readInitialLocale()));
  const manualChoice = useRef(0);
  const { t } = useI18nextTranslation('common', { i18n: instance });
  useEffect(() => observeI18nResources(instance), [instance]);
  const locale = isLocale(instance.language) ? instance.language : DEFAULT_LOCALE;
  const setLocale = useCallback(
    (next: Locale) => {
      if (!isLocale(next)) return;
      manualChoice.current += 1;
      // 语言包已同步注册，切换不等待网络；语言状态和订阅统一由 i18next 管理。
      void instance.changeLanguage(next);
      // 只持久化手动选择，避免首次启动后把“跟随系统”意外固定为某种语言。
      persistLocale(next);
    },
    [instance],
  );

  useEffect(() => {
    if (initialLocale !== undefined || readStoredLocale() !== null) return;
    const controller = new AbortController();
    const choice = manualChoice.current;
    void readInstallationLocale(controller.signal).then((installed) => {
      // 升级和异步恢复不得覆盖用户已作出的选择，即使本机存储被禁用。
      if (
        installed !== null &&
        !controller.signal.aborted &&
        manualChoice.current === choice &&
        readStoredLocale() === null
      ) {
        void instance.changeLanguage(installed);
      }
    });
    return () => controller.abort();
  }, [initialLocale, instance]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('documentDescription'));
  }, [locale, t]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <I18nextProvider i18n={instance}>
      <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    </I18nextProvider>
  );
}
