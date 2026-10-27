import { useId } from 'react';

import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import { LanguageMenu } from './LanguageMenu';
import styles from './LanguageSwitcher.module.css';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const { t } = useTranslation('common');

  return (
    <div className={`${styles.switcher} ${compact ? styles.compact : ''}`}>
      {compact && <UiIcon name="language" className={styles.globe} />}
      <label htmlFor={id}>{t('languageLabel')}</label>
      <LanguageMenu variant="select" triggerId={id} />
    </div>
  );
}
