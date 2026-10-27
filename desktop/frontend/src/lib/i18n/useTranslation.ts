import { useContext } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';

import { I18nContext } from './context';
import type { Namespace } from './resources';

export function useTranslation<N extends Namespace>(namespace: N) {
  const context = useContext(I18nContext);
  const { t } = useI18nextTranslation(namespace);
  if (!context) throw new Error('useTranslation 必须在 I18nProvider 内使用');

  return { ...context, t };
}
