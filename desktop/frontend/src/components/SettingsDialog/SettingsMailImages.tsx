import { useId, useState } from 'react';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { setImagePolicy, useImagePolicy } from '../../lib/preferences/mailImages';
import styles from './SettingsDialog.module.css';

export function SettingsMailImages() {
  const { t } = useTranslation('settings');
  const policy = useImagePolicy();
  const id = useId();
  const [notSaved, setNotSaved] = useState(false);
  return (
    <section className={`${styles.card} ${styles['mail-images']}`} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('mailImages')}</h3>
      <p id={`${id}-hint`} className={styles['image-hint']}>
        {t('mailImagesHint')}
      </p>
      <fieldset className={styles['image-options']} aria-describedby={`${id}-hint`}>
        <legend className={styles['screen-reader-only']}>{t('mailImages')}</legend>
        {(['none', 'inline', 'all'] as const).map((value) => (
          <label key={value} className={styles['image-option']}>
            <input
              type="radio"
              name={id}
              value={value}
              checked={policy === value}
              onChange={() => setNotSaved(!setImagePolicy(value))}
            />
            <span>
              {t(
                value === 'none' ? 'imagesNone' : value === 'inline' ? 'imagesInline' : 'imagesAll',
              )}
            </span>
          </label>
        ))}
      </fieldset>
      {notSaved && (
        <p role="alert" className={styles['image-hint']}>
          {t('imagesNotSaved')}
        </p>
      )}
    </section>
  );
}
