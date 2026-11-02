import { useEffect, useId, useRef, useState } from 'react';
import {
  cancelWindowClose,
  resolveWindowClose,
  type CloseMode,
} from '../../lib/bridge/windowLifecycle';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './WindowCloseDialog.module.css';

interface Props {
  backgroundAvailable: boolean;
  onResolved: () => void;
}

// 选择、记住与提交共享同一异步门禁，集中维护可避免退出请求和取消请求交错。
export function WindowCloseDialog({ backgroundAvailable, onResolved }: Props) {
  const { t } = useTranslation('settings');
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const [choice, setChoice] = useState<Exclude<CloseMode, 'ask'>>();
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    cancel.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  const run = async (operation: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      await operation();
      onResolved();
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const cancelClose = () => void run(cancelWindowClose);
  return (
    <DialogFrame
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending.current) cancelClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
        const controls = [
          ...(ref.current?.querySelectorAll<HTMLElement>('button, input') ?? []),
        ].filter((element) => element.tabIndex >= 0 && !element.matches(':disabled'));
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className={styles.heading}>
        <div className={styles['title-row']}>
          <h2 id={`${id}-title`}>{t('closePromptTitle')}</h2>
          <button
            type="button"
            className={styles.dismiss}
            aria-label={t('closeDismiss')}
            disabled={busy}
            onClick={cancelClose}
          >
            <UiIcon name="close" size={18} />
          </button>
        </div>
        <p id={`${id}-description`}>{t('closePromptDescription')}</p>
      </div>
      <fieldset className={styles.choices} disabled={busy}>
        <legend className={styles.sr}>{t('closeBehavior')}</legend>
        {(['background', 'quit'] as const).map((mode) => (
          <label key={mode} className={styles.choice} data-selected={choice === mode}>
            <input
              type="radio"
              name={`${id}-choice`}
              value={mode}
              checked={choice === mode}
              tabIndex={choice && choice !== mode ? -1 : 0}
              aria-label={t(mode === 'background' ? 'closeBackground' : 'closeQuit')}
              aria-describedby={`${id}-${mode}-hint`}
              disabled={mode === 'background' && !backgroundAvailable}
              onChange={() => setChoice(mode)}
            />
            <span className={styles['choice-icon']} aria-hidden="true">
              <UiIcon name={mode === 'background' ? 'mailOpen' : 'close'} size={19} />
            </span>
            <span className={styles['choice-copy']}>
              <strong>{t(mode === 'background' ? 'closeBackground' : 'closeQuit')}</strong>
              <small id={`${id}-${mode}-hint`}>
                {t(mode === 'background' ? 'closeBackgroundHint' : 'closeQuitHint')}
              </small>
            </span>
            <span className={styles['selected-mark']} aria-hidden="true">
              {choice === mode && <UiIcon name="check" size={12} />}
            </span>
          </label>
        ))}
      </fieldset>
      {!backgroundAvailable && <p className={styles.hint}>{t('closeBackgroundUnavailable')}</p>}
      <label className={styles.remember}>
        <input
          type="checkbox"
          checked={remember}
          disabled={busy}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <span>
          {t('closeRemember')}
          <small>{t('closeRememberHint')}</small>
        </span>
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {t('closeResolveError')}
        </p>
      )}
      <footer className={styles.actions}>
        <button
          ref={cancel}
          type="button"
          disabled={busy}
          data-button-variant="secondary"
          onClick={cancelClose}
        >
          {t('closeCancel')}
        </button>
        <button
          type="button"
          disabled={busy || !choice}
          onClick={() => {
            if (choice) void run(() => resolveWindowClose(choice, remember));
          }}
        >
          {t(
            busy
              ? 'closeProcessing'
              : choice === 'quit'
                ? 'closeQuit'
                : choice === 'background'
                  ? 'closeBackground'
                  : 'closeConfirm',
          )}
        </button>
      </footer>
    </DialogFrame>
  );
}
