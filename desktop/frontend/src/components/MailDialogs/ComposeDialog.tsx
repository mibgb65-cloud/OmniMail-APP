import { useEffect, useId, useRef, useState } from 'react';
import * as api from '../../lib/bridge/mail';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { useMailDialog } from './useMailDialog';
import styles from './MailDialogs.module.css';

export function ComposeDialog({
  accounts,
  selectedAccount,
  onClose,
  onSent,
}: {
  accounts: api.AccountSummary[];
  selectedAccount: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useTranslation('mail');
  const ref = useMailDialog();
  const title = useId();
  const available = accounts.filter((account) => account.status === 'configured');
  const [accountId, setAccountId] = useState(selectedAccount || available[0]?.id || '');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const uncertain = error != null && api.errorCode(error) === 'SEND_UNCERTAIN';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      await api.send({ accountId, to, subject, body }, controller.signal);
      setSent(true);
      onSent();
    } catch (error) {
      if (!controller.signal.aborted) setError(error);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <header>
          <h2 id={title}>{t('composeTitle')}</h2>
          <button type="button" disabled={busy} onClick={onClose}>
            {t('close')}
          </button>
        </header>
        <div className={styles.content}>
          <fieldset className={styles.fields} disabled={busy || sent || uncertain}>
            <label>
              {t('from')}
              <select
                value={accountId}
                required
                onChange={(event) => setAccountId(event.currentTarget.value)}
              >
                {available.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName || account.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('to')}
              <input
                required
                maxLength={8192}
                value={to}
                onChange={(event) => setTo(event.currentTarget.value)}
              />
            </label>
            <label>
              {t('subject')}
              <input
                maxLength={512}
                value={subject}
                onChange={(event) => setSubject(event.currentTarget.value)}
              />
            </label>
            <label>
              {t('body')}
              <textarea
                maxLength={1_048_576}
                value={body}
                onChange={(event) => setBody(event.currentTarget.value)}
              />
            </label>
          </fieldset>
          <p className={styles.hint}>{t('composeHint')}</p>
          {error != null && (
            <p role="alert" className={styles.error}>
              {t(api.errorKey(error))}
            </p>
          )}
          {sent && <p role="status">{t('sent')}</p>}
        </div>
        <footer>
          <span role="status">{busy ? t('sending') : ''}</span>
          <button type="submit" disabled={busy || sent || uncertain || !accountId}>
            {t('send')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
