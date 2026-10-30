import { useEffect, useId, useRef, useState } from 'react';
import { openMailLink } from '../../lib/bridge/links';
import { safeMailURL } from '../../lib/mail/mailDocument';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import styles from './ExternalLinkDialog.module.css';

export function ExternalLinkDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation('mail');
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const opening = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { closing, close } = useDialogExit(ref, onClose);
  const target = safeMailURL(url);
  let host = '';
  if (target) {
    const parsed = new URL(target);
    host = parsed.hostname || parsed.protocol;
  }
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    cancel.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  const open = async () => {
    if (!target || opening.current) return;
    opening.current = true;
    setBusy(true);
    try {
      await openMailLink(target);
      close();
    } catch {
      setFailed(true);
      opening.current = false;
      setBusy(false);
    }
  };
  return (
    <DialogFrame
      ref={ref}
      closing={closing}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        if (event.shiftKey && document.activeElement === cancel.current) {
          event.preventDefault();
          confirm.current?.focus();
        } else if (!event.shiftKey && document.activeElement === confirm.current) {
          event.preventDefault();
          cancel.current?.focus();
        }
      }}
    >
      <div className={styles.content}>
        <span className={styles.eyebrow}>{t('externalDestination')}</span>
        <h2 id={`${id}-title`}>{t('externalLinkTitle')}</h2>
        <p id={`${id}-description`}>{t('externalLinkWarning')}</p>
        <div className={styles.destination}>
          <strong>{host}</strong>
          <span>{target ?? t('linkUnavailable')}</span>
        </div>
        {failed && (
          <p role="alert" className={styles.error}>
            {t('linkUnavailable')}
          </p>
        )}
        <footer className={styles.actions}>
          <button
            ref={cancel}
            type="button"
            className={styles.cancel}
            disabled={busy}
            onClick={close}
          >
            {t('cancelExternalLink')}
          </button>
          <button
            ref={confirm}
            type="button"
            disabled={busy || !target}
            onClick={() => void open()}
          >
            {t('confirmExternalLink')}
          </button>
        </footer>
      </div>
    </DialogFrame>
  );
}
