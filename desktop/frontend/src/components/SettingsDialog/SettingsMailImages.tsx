import { useId, useState } from 'react';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { setImagePolicy, useImagePolicy } from '../../lib/preferences/mailImages';
import { UiIcon } from '../UiIcon/UiIcon';
import choices from './SettingsMailImages.module.css';
import styles from './SettingsDialog.module.css';

const options = [
  { value: 'none', label: 'imagesNone', icon: 'imageOff' },
  { value: 'inline', label: 'imagesInline', icon: 'image' },
  { value: 'all', label: 'imagesAll', icon: 'globe' },
] as const;

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
      <fieldset
        className={choices.options}
        aria-describedby={`${id}-hint`}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.altKey || event.metaKey) return;
          const current = options.findIndex((option) => option.value === policy);
          let next: number;
          if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = options.length - 1;
          else if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
            next = (current + 1) % options.length;
          else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
            next = (current - 1 + options.length) % options.length;
          else return;
          event.preventDefault();
          const option = options[next];
          if (!option) return;
          setNotSaved(!setImagePolicy(option.value));
          event.currentTarget.querySelector<HTMLInputElement>(`[value="${option.value}"]`)?.focus();
        }}
      >
        <legend className={styles['screen-reader-only']}>{t('mailImages')}</legend>
        {options.map(({ value, label, icon }) => (
          <label key={value} className={choices.option} data-selected={policy === value}>
            <input
              type="radio"
              name={id}
              value={value}
              checked={policy === value}
              tabIndex={policy === value ? 0 : -1}
              aria-label={t(label)}
              onChange={() => setNotSaved(!setImagePolicy(value))}
            />
            <span className={choices.icon} aria-hidden="true">
              <UiIcon name={icon} size={18} />
            </span>
            <span className={choices.copy} aria-hidden="true">
              <span>{t(value === 'inline' ? 'imagesInlineLabel' : label)}</span>
              {value === 'inline' && (
                <small className={choices.recommended}>{t('imagesRecommended')}</small>
              )}
            </span>
            <span className={choices.selected} aria-hidden="true">
              {policy === value && <UiIcon name="check" size={12} />}
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
