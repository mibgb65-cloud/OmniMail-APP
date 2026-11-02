import { useTranslation } from '../../lib/i18n/useTranslation';
import { useEffect, useRef, useState } from 'react';
import { translationErrorKey } from '../../lib/bridge/translation';
import { UiIcon } from '../UiIcon/UiIcon';
import { useMailTranslation } from './MailTranslationContext';
import toolbar from '../../app/MailToolbar.module.css';
import styles from './MailTranslationToolbar.module.css';
import { MailTranslationToggle } from './MailTranslationToggle';

export function MailTranslateAction({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation('translation');
  const translation = useMailTranslation();
  const root = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState<unknown>();
  const notice =
    translation?.error ?? (translation?.result?.warning ? translation.result : undefined);
  const visible = notice != null && notice !== dismissed;
  useEffect(() => {
    if (!visible) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setDismissed(notice);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissed(notice);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [notice, visible]);
  const hint = translation?.error
    ? t(translationErrorKey(translation.error))
    : translation?.result
      ? `${t('machine')} · ${t(translation.result.target)}${translation.result.cached ? ` · ${t('cached')}` : ''}`
      : t(translation?.available ? 'button' : 'unavailable');
  return (
    <div ref={root} className={styles.root}>
      <button
        type="button"
        data-button-variant="ghost"
        className={toolbar['icon-button']}
        aria-label={t('button')}
        data-tooltip={translation?.busy ? t('cancelTranslation') : visible ? undefined : hint}
        aria-busy={translation?.busy || undefined}
        aria-haspopup="dialog"
        disabled={disabled || !translation?.available}
        onClick={() => {
          if (translation?.busy) translation.cancel();
          else {
            setDismissed(notice);
            translation?.open();
          }
        }}
      >
        <UiIcon name={translation?.busy ? 'sync' : 'language'} />
      </button>
      {notice != null && <span className={styles.badge} aria-hidden="true" />}
      {translation?.result && (
        <MailTranslationToggle
          show={translation.show}
          onChange={translation.setShow}
          disabled={disabled || translation.busy}
          hint={hint}
        />
      )}
      {visible && (
        <div className={styles.feedback} role={translation?.error ? 'alert' : 'status'}>
          <p>
            {translation?.error
              ? t(translationErrorKey(translation.error))
              : t(
                  translation?.result?.warning === 'CACHE_REBUILT'
                    ? 'cacheRebuilt'
                    : 'cacheWarning',
                )}
          </p>
          <div className={styles['feedback-actions']}>
            <button
              type="button"
              data-button-variant="secondary"
              onClick={() => setDismissed(notice)}
            >
              {t('dismissFeedback')}
            </button>
            {translation?.error != null && (
              <button
                type="button"
                onClick={() => {
                  setDismissed(notice);
                  translation.open();
                }}
              >
                {t('retry')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
