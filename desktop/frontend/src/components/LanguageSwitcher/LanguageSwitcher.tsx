import type { KeyboardEvent } from 'react';

import { SUPPORTED_LOCALES } from '../../lib/i18n/resources';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './LanguageSwitcher.module.css';

interface LanguageSwitcherProps {
  compact?: boolean;
}

const labels = {
  'zh-CN': { short: 'simplifiedChineseShort', full: 'simplifiedChinese' },
  en: { short: 'englishShort', full: 'english' },
} as const;

function focusLanguage(event: KeyboardEvent<HTMLDivElement>) {
  const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
  const current = options.findIndex((option) => option === event.target);
  if (current < 0) return;
  let next: number;
  switch (event.key) {
    case 'ArrowRight':
      next = (current + 1) % options.length;
      break;
    case 'ArrowLeft':
      next = (current - 1 + options.length) % options.length;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = options.length - 1;
      break;
    default:
      return;
  }
  // 方向键只浏览语言，确认仍由原生按钮的 Enter/Space/click 触发。
  event.preventDefault();
  options[next]?.focus();
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { t, locale, setLocale } = useTranslation('common');

  return (
    <div className={styles.switcher}>
      {!compact && <span className={styles.label}>{t('languageLabel')}</span>}
      <div
        role="group"
        aria-label={t('changeLanguage')}
        className={styles.capsule}
        onKeyDown={focusLanguage}
      >
        <UiIcon name="language" size={16} className={styles.icon} />
        <div className={styles.options}>
          <span
            aria-hidden="true"
            className={styles.indicator}
            style={{ transform: `translateX(${SUPPORTED_LOCALES.indexOf(locale) * 100}%)` }}
          />
          {SUPPORTED_LOCALES.map((value) => (
            <button
              key={value}
              type="button"
              className={styles.option}
              lang={value}
              aria-label={t(labels[value].full)}
              data-tooltip={t(labels[value].full)}
              aria-pressed={locale === value}
              onClick={() => setLocale(value)}
            >
              {t(labels[value].short)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
