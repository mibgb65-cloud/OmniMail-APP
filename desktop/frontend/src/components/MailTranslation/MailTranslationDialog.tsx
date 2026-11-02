import { useEffect, useId, useRef, useState } from 'react';
import {
  isTranslationLanguage,
  saveTranslationPreferences,
  translationErrorKey,
  translationLanguages,
  translationPreferences,
  type TranslationLanguage,
} from '../../lib/bridge/translation';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './MailTranslation.module.css';

// 授权先保存，且只有同一弹窗仍有效并退出后才开始外发；取消和动作引用须在此统一协调。
export function MailTranslationDialog({
  onClose,
  onTranslate,
}: {
  onClose: () => void;
  onTranslate: (target: TranslationLanguage) => void;
}) {
  const { t } = useTranslation('translation');
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController>();
  const pending = useRef(false);
  const [target, setTarget] = useState<TranslationLanguage>('zh');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const action = useRef<TranslationLanguage>();
  const exit = useDialogExit(ref, () => {
    onClose();
    if (action.current) onTranslate(action.current);
  });
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => {
      request.current?.abort();
      if (node?.open) node.close();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void translationPreferences(controller.signal).then(
      (prefs) => {
        if (!controller.signal.aborted) {
          setTarget(prefs.target);
          setConsent(prefs.consent);
          setStatus('ready');
        }
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason);
          setStatus('error');
        }
      },
    );
    return () => controller.abort();
  }, [attempt]);
  const close = () => {
    action.current = undefined;
    request.current?.abort();
    exit.close();
  };
  const save = async (translate: boolean) => {
    if (pending.current || status !== 'ready' || (translate && !consent)) return;
    pending.current = true;
    const controller = new AbortController();
    request.current = controller;
    setStatus('saving');
    setError(undefined);
    try {
      await saveTranslationPreferences({ target, consent }, controller.signal);
      if (!controller.signal.aborted) {
        if (translate) action.current = target;
        exit.close();
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason);
        setStatus('ready');
      }
    } finally {
      pending.current = false;
    }
  };
  return (
    <DialogFrame
      ref={ref}
      closing={exit.closing}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className={styles.header}>
        <div>
          <h2 id={`${id}-title`}>{t('title')}</h2>
          <p>{t('sourceAuto')}</p>
        </div>
        <button type="button" className={styles.close} aria-label={t('cancel')} onClick={close}>
          <UiIcon name="close" />
        </button>
      </header>
      <div className={styles.content}>
        {status === 'loading' && <p role="status">{t('loading')}</p>}
        {error != null && (
          <p role="alert" className={styles.error}>
            {t(translationErrorKey(error))}
          </p>
        )}
        {status === 'error' && (
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              setAttempt((value) => value + 1);
            }}
          >
            {t('retry')}
          </button>
        )}
        <fieldset disabled={status !== 'ready'} className={styles.languages}>
          <legend>{t('target')}</legend>
          {translationLanguages.map((language) => (
            <label key={language} className={styles.language} data-selected={language === target}>
              <input
                type="radio"
                name={id}
                value={language}
                checked={language === target}
                onChange={(event) => {
                  if (isTranslationLanguage(event.target.value)) setTarget(event.target.value);
                }}
              />
              <span>{t(language)}</span>
            </label>
          ))}
        </fieldset>
        <div className={styles.notice}>
          <UiIcon name="about" />
          <p>{t('privacy')}</p>
        </div>
        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={consent}
            disabled={status !== 'ready'}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>
            {t('consent')}
            <small>{t('consentHint')}</small>
          </span>
        </label>
      </div>
      <footer className={styles.actions}>
        <button
          type="button"
          data-button-variant="secondary"
          disabled={status !== 'ready'}
          onClick={() => void save(false)}
        >
          {t('saveOnly')}
        </button>
        <button
          type="button"
          disabled={status !== 'ready' || !consent}
          onClick={() => void save(true)}
        >
          {t(status === 'saving' ? 'saving' : 'start')}
        </button>
      </footer>
    </DialogFrame>
  );
}
