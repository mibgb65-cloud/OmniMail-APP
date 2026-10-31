import { useEffect, useId, useRef } from 'react';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './DisconnectAccountDialog.module.css';

interface Props {
  email: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DisconnectAccountDialog({ email, onConfirm, onClose }: Props) {
  const { t } = useTranslation('mail');
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const confirmed = useRef(false);
  const { closing, close } = useDialogExit(ref, onClose);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    cancel.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <DialogFrame
      data-native-scrollbar=""
      ref={ref}
      closing={closing}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        close();
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
        <div className={styles.icon}>
          <UiIcon name="accounts" size={22} />
        </div>
        <h2 id={`${id}-title`}>{t('disconnectTitle')}</h2>
        <p className={styles.email}>{email}</p>
        <p id={`${id}-description`} className={styles.description}>
          {t('disconnectConfirm')}
        </p>
        <footer className={styles.actions}>
          <button ref={cancel} type="button" data-button-variant="secondary" onClick={close}>
            {t('cancel')}
          </button>
          <button
            ref={confirm}
            type="button"
            className={styles.confirm}
            onClick={() => {
              if (confirmed.current) return;
              confirmed.current = true;
              onConfirm();
              close();
            }}
          >
            {t('disconnect')}
          </button>
        </footer>
      </div>
    </DialogFrame>
  );
}
