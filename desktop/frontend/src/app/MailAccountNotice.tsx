import * as api from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import type { MailController } from './useMail';
import { mailboxState } from './mailboxState';
import styles from './MailAccountNotice.module.css';

interface Notice {
  kind: 'error' | 'info';
  text:
    | 'accountReadFailed'
    | 'syncFailedHint'
    | 'syncWaitingHint'
    | 'syncCachedHint'
    | 'reauthHint'
    | 'disconnectedHint'
    | 'noAccountsHint';
  error?: unknown;
  action?: 'reload' | 'sync';
}
export function mailAccountNotice(mail: MailController): Notice | undefined {
  if (mail.error != null)
    return { kind: 'error', text: 'accountReadFailed', error: mail.error, action: 'reload' };
  const selected = mail.accounts.filter(
    (account) => !mail.accountId || account.id === mail.accountId,
  );
  const active = selected.filter((account) => mailboxState(account) !== 'disconnected');
  if (active.some((account) => mailboxState(account) === 'reauth')) {
    return { kind: 'error', text: 'reauthHint' };
  }
  const failed = active.find((account) => mailboxState(account) === 'error');
  if (failed)
    return { kind: 'error', text: 'syncFailedHint', error: failed.sync.errorCode, action: 'sync' };
  if (selected.length && !active.length) return { kind: 'info', text: 'disconnectedHint' };
  if (!selected.length && !mail.messages.length) return { kind: 'info', text: 'noAccountsHint' };
}

export function mailSyncState(mail: MailController) {
  const accounts = mail.accounts.filter(
    (account) => !mail.accountId || account.id === mail.accountId,
  );
  if (mail.syncRequested || accounts.some((account) => mailboxState(account) === 'running'))
    return 'running';
  if (accounts.some((account) => mailboxState(account) === 'error')) return 'error';
  if (accounts.some((account) => mailboxState(account) === 'partial')) return 'partial';
  return 'idle';
}

export function MailAccountNotice({ mail, notice }: { mail: MailController; notice?: Notice }) {
  const { t } = useTranslation('mail');
  if (!notice) return null;
  return (
    <div
      className={styles.notice}
      data-kind={notice.kind}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      <p>{t(notice.text)}</p>
      {notice.error != null && <p>{t(api.errorKey(notice.error))}</p>}
      {notice.action && (
        <button
          type="button"
          disabled={notice.action === 'sync' && mail.syncRequested}
          onClick={() => {
            if (notice.action === 'reload') mail.refresh();
            else void mail.sync();
          }}
        >
          {t(notice.action === 'reload' ? 'retryAccounts' : 'retrySync')}
        </button>
      )}
    </div>
  );
}

export function MailConnectionState({ mail }: { mail: MailController }) {
  const { t } = useTranslation('mail');
  return (
    <section className={styles.connection} aria-busy={mail.error == null}>
      <h2>{t(mail.error != null ? 'accountsUnavailable' : 'accountsLoading')}</h2>
      {mail.error != null ? (
        <>
          <p role="alert">{t(api.errorKey(mail.error))}</p>
          <button type="button" onClick={mail.refresh}>
            {t('retryAccounts')}
          </button>
        </>
      ) : (
        <p role="status">{t('accountsLoading')}</p>
      )}
    </section>
  );
}
