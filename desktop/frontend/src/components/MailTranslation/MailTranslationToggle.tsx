import { useRef, useState } from 'react';
import { useTranslation } from '../../lib/i18n/useTranslation';
import styles from './MailTranslationToolbar.module.css';

export function MailTranslationToggle({
  show,
  onChange,
  disabled = false,
  hint,
}: {
  show: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  hint: string;
}) {
  const { t } = useTranslation('translation');
  const start = useRef<number>();
  const dragged = useRef(false);
  const [preview, setPreview] = useState<boolean>();
  return (
    <span className={styles.slot}>
      <button
        type="button"
        role="switch"
        aria-label={t('viewSwitch')}
        aria-checked={show}
        className={styles.toggle}
        disabled={disabled}
        data-show={(preview ?? show) ? 'translated' : 'original'}
        data-tooltip={hint}
        onClick={(event) => {
          if (event.detail > 0 && dragged.current) {
            dragged.current = false;
            return;
          }
          dragged.current = false;
          if (event.detail > 0) {
            const bounds = event.currentTarget.getBoundingClientRect();
            onChange(event.clientX >= bounds.left + bounds.width / 2);
          } else onChange(!show);
        }}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.altKey || event.metaKey) return;
          if (event.key === 'ArrowLeft' || event.key === 'Home') {
            event.preventDefault();
            onChange(false);
          } else if (event.key === 'ArrowRight' || event.key === 'End') {
            event.preventDefault();
            onChange(true);
          }
        }}
        onPointerDown={(event) => {
          if (disabled || event.button > 0) return;
          start.current = event.clientX;
          dragged.current = false;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (start.current === undefined || Math.abs(event.clientX - start.current) < 4) return;
          dragged.current = true;
          const bounds = event.currentTarget.getBoundingClientRect();
          setPreview(event.clientX >= bounds.left + bounds.width / 2);
        }}
        onPointerUp={(event) => {
          if (start.current === undefined) return;
          if (dragged.current) {
            const bounds = event.currentTarget.getBoundingClientRect();
            onChange(event.clientX >= bounds.left + bounds.width / 2);
          }
          start.current = undefined;
          setPreview(undefined);
          if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          start.current = undefined;
          dragged.current = false;
          setPreview(undefined);
        }}
      >
        <span className={styles.thumb} aria-hidden="true" />
        <span className={styles.original} aria-hidden="true">
          {t('originalShort')}
        </span>
        <span className={styles.translated} aria-hidden="true">
          {t('translatedShort')}
        </span>
      </button>
    </span>
  );
}
