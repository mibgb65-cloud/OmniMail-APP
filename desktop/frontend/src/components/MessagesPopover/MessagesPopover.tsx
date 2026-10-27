import { useEffect, useId, useRef, useState } from 'react';

import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './MessagesPopover.module.css';

export function MessagesPopover() {
  const { t } = useTranslation('messages');
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissWindow = () => setOpen(false);
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside, true);
    window.addEventListener('blur', dismissWindow);
    window.addEventListener('resize', dismissWindow);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside, true);
      window.removeEventListener('blur', dismissWindow);
      window.removeEventListener('resize', dismissWindow);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape' || event.ctrlKey || event.altKey || event.metaKey)
          return;
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={t('title')}
        title={t('title')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <UiIcon name="bell" className={styles.icon} selected={open} />
      </button>
      {open && (
        <section
          ref={panelRef}
          id={id}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          tabIndex={-1}
          className={styles.panel}
        >
          <header className={styles.header}>
            <h2 id={`${id}-title`}>{t('title')}</h2>
            <button
              type="button"
              className={styles.close}
              aria-label={t('close')}
              title={t('close')}
              onClick={() => close(true)}
            >
              <UiIcon name="close" />
            </button>
          </header>
          <div className={styles.empty}>
            <UiIcon name="bell" className={styles['empty-icon']} />
            <strong>{t('emptyTitle')}</strong>
            <p id={`${id}-description`}>{t('emptyDescription')}</p>
          </div>
        </section>
      )}
    </div>
  );
}
