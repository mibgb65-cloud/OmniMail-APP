import { useId } from 'react';

import { SUPPORTED_LOCALES } from '../../lib/i18n/resources';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import { useLanguageMenu } from './useLanguageMenu';
import styles from './LanguageMenu.module.css';

const labels = { 'zh-CN': 'simplifiedChinese', en: 'english' } as const;

export function LanguageMenu({
  variant = 'icon',
  triggerId,
}: {
  variant?: 'icon' | 'select';
  triggerId?: string;
}) {
  const id = useId();
  const { t, locale, setLocale } = useTranslation('common');
  const {
    open,
    activeIndex,
    rootRef,
    triggerRef,
    menuRef,
    itemRefs,
    show,
    hide,
    select,
    onTriggerKeyDown,
    onMenuKeyDown,
  } = useLanguageMenu(locale, setLocale);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        className={`${styles.trigger} ${variant === 'select' ? styles['select-trigger'] : ''}`}
        aria-label={t(variant === 'select' ? 'languageLabel' : 'changeLanguage')}
        title={t('changeLanguage')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onKeyDown={onTriggerKeyDown}
        onClick={() => (open ? hide() : show())}
      >
        {variant === 'select' ? (
          <>
            <span>{t(labels[locale])}</span>
            <UiIcon name={open ? 'chevronUp' : 'chevronDown'} className={styles.chevron} />
          </>
        ) : (
          <UiIcon name="language" className={styles.icon} selected={open} />
        )}
      </button>
      {open && (
        <div
          id={id}
          ref={menuRef}
          role="menu"
          aria-label={t('languageLabel')}
          className={styles.menu}
          onKeyDown={onMenuKeyDown}
        >
          {SUPPORTED_LOCALES.map((value, index) => (
            <button
              key={value}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitemradio"
              className={styles.item}
              lang={value}
              aria-checked={locale === value}
              tabIndex={activeIndex === index ? 0 : -1}
              data-active={activeIndex === index}
              onPointerMove={() => {
                if (activeIndex !== index) show(index);
              }}
              onClick={() => select(value)}
            >
              <span>{t(labels[value])}</span>
              <span className={styles.check} aria-hidden="true">
                <UiIcon name="check" selected={locale === value} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
