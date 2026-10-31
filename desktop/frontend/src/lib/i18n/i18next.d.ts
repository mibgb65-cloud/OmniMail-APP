import 'i18next';

import type { Translations } from './resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Translations;
    returnNull: false;
    strictKeyChecks: true;
  }
}
