import type { AccountSummary } from '../../lib/bridge/mail';
import { errorKey } from '../../lib/bridge/mail';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { limitedMessageCount, mailboxState, mailboxStateLabels } from '../../app/mailboxState';
import { getProviderLabel } from '../MailDialogs/ProviderSelection';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './MailboxManagementDialog.module.css';

interface Props {
  account: AccountSummary;
  busy: boolean;
  canDisconnect: boolean;
  canSync: boolean;
  onDisconnect: (trigger: HTMLButtonElement) => void;
  onSync: (trigger: HTMLButtonElement) => void;
}

export function MailboxAccountDetails({
  account,
  busy,
  canDisconnect,
  canSync,
  onDisconnect,
  onSync,
}: Props) {
  const { t } = useTranslation('mail');
  const state = mailboxState(account);
  const count = account.messageCount;
  return (
    <>
      <section className={styles.card} aria-label={t('accountOverview')}>
        <div className={styles.identity}>
          <span className={styles.avatar}>
            <UiIcon name="accounts" size={23} />
          </span>
          <div>
            <h3>{account.displayName || t('accountOverview')}</h3>
            <p className={styles.email}>{account.email}</p>
          </div>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>{t('accountProvider')}</dt>
            <dd>
              {getProviderLabel({ code: account.providerCode, name: account.providerCode }, t)}
            </dd>
          </div>
          <div>
            <dt>{t('accountStatus')}</dt>
            <dd className={styles.status} data-state={state}>
              {t(mailboxStateLabels[state])}
            </dd>
          </div>
          {typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 && (
            <div>
              <dt>{t('accountLocalMessages')}</dt>
              <dd>{t('accountLocalMessageCount', { count })}</dd>
            </div>
          )}
        </dl>
        {state === 'error' && <p className={styles.hint}>{t(errorKey(account.sync.errorCode))}</p>}
        {state === 'reauth' && <p className={styles.hint}>{t('reauthHint')}</p>}
        {state !== 'disconnected' && limitedMessageCount(account) > 0 && (
          <p className={styles.hint}>
            {t('mailboxLimitedHint', { count: limitedMessageCount(account) })}
          </p>
        )}
        {canSync && state !== 'disconnected' && state !== 'reauth' && state !== 'limited' && (
          <button
            type="button"
            data-button-variant="secondary"
            className={styles.sync}
            disabled={busy || state === 'running' || state === 'partial'}
            onClick={(event) => onSync(event.currentTarget)}
          >
            <UiIcon name="sync" size={15} />
            {state === 'running' || state === 'partial' ? t('syncing') : t('retrySync')}
          </button>
        )}
      </section>
      <section
        className={`${styles.card} ${styles.connection}`}
        aria-label={t('accountConnection')}
      >
        <h3>{t('accountConnection')}</h3>
        <p className={styles.hint}>
          {t(state === 'disconnected' ? 'disconnectedHint' : 'accountDisconnectHint')}
        </p>
        {canDisconnect && state !== 'disconnected' && (
          <button
            type="button"
            data-button-variant="secondary"
            className={styles.disconnect}
            aria-label={`${t('disconnect')}: ${account.email}`}
            disabled={busy}
            onClick={(event) => onDisconnect(event.currentTarget)}
          >
            {t('disconnect')}
          </button>
        )}
      </section>
    </>
  );
}
