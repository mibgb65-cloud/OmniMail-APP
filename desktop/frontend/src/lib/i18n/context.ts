import { createContext } from 'react';

import type { Locale } from './resources';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);
