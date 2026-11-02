import { useRef } from 'react';
import { DialogFrame } from '../components/DialogFrame/DialogFrame';
import { useDialogExit } from '../components/DialogFrame/useDialogExit';
import { useMailDialog } from '../components/MailDialogs/useMailDialog';
import { useTranslation } from '../lib/i18n/useTranslation';
import type { Composer } from './useComposer';
import styles from './ComposePanel.module.css';

export function ComposeConfirmation({ composer }: { composer: Composer }) {
  const { t } = useTranslation('mail');
  const dialog = useMailDialog();
  const action = useRef<() => void>(composer.cancelConfirmation);
  const { closing, close } = useDialogExit(dialog, () => action.current());
  const finish = (next: () => void) => {
    action.current = next;
    close();
  };
  const discard = composer.confirmation?.kind === 'discard';
  return (
    <DialogFrame
      ref={dialog}
      closing={closing}
      className={styles.confirmation}
      aria-label={t(discard ? 'composeDiscardTitle' : 'composeSendEmptyTitle')}
      onCancel={(event) => {
        event.preventDefault();
        finish(composer.cancelConfirmation);
      }}
    >
      <h2>{t(discard ? 'composeDiscardTitle' : 'composeSendEmptyTitle')}</h2>
      <p>
        {t(
          discard
            ? composer.session?.status === 'uncertain'
              ? 'composeDiscardUncertain'
              : 'composeDiscardText'
            : 'composeSendEmptyText',
        )}
      </p>
      <footer>
        <button type="button" onClick={() => finish(composer.cancelConfirmation)}>
          {t('composeKeepEditing')}
        </button>
        <button
          type="button"
          onClick={() =>
            finish(
              discard
                ? composer.confirmDiscard
                : () => {
                    void composer.confirmSend();
                  },
            )
          }
        >
          {t(discard ? 'composeDiscard' : 'composeConfirmSend')}
        </button>
      </footer>
    </DialogFrame>
  );
}
