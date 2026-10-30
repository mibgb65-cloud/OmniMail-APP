import { useId } from 'react';
import { ScrollArea } from '../components/ScrollArea/ScrollArea';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { errorKey, type AccountSummary } from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { mailboxState, mailboxStateLabels } from './mailboxState';
import styles from './MailboxAccounts.module.css';

interface Props {
  accounts: AccountSummary[];
  selectedAccount: string;
  onSelectAccount?: (id: string) => void;
  onDisconnect?: (id: string) => void;
}

export function MailboxAccounts({
  accounts,
  selectedAccount,
  onSelectAccount,
  onDisconnect,
}: Props) {
  const { t } = useTranslation('mail');
  const prefix = useId();
  return (
    <ScrollArea className={styles.list}>
      <button
        type="button"
        className={styles.all}
        aria-pressed={selectedAccount === ''}
        onClick={() => onSelectAccount?.('')}
      >
        <UiIcon name="accounts" size={16} />
        <span>{t('allAccounts')}</span>
      </button>
      <ul className={styles.accounts}>
        {accounts.map((account, index) => {
          const state = mailboxState(account);
          const label = t(mailboxStateLabels[state]);
          const statusId = `${prefix}-status-${index}`;
          const explanation = state === 'error' ? t(errorKey(account.sync.errorCode)) : label;
          return (
            <li
              key={account.id}
              className={styles.row}
              data-selected={selectedAccount === account.id}
            >
              <button
                type="button"
                className={styles.select}
                aria-pressed={selectedAccount === account.id}
                aria-label={account.displayName || account.email}
                aria-describedby={statusId}
                data-tooltip={`${account.email} · ${explanation}`}
                onClick={() => onSelectAccount?.(account.id)}
              >
                <span className={styles.identity}>{account.displayName || account.email}</span>
                <span id={statusId} className={styles.status} data-state={state}>
                  {state === 'running' ? (
                    <span className={styles.spinner}>
                      <UiIcon name="sync" size={12} />
                    </span>
                  ) : (
                    <span className={styles.dot} aria-hidden="true" />
                  )}
                  <span>{label}</span>
                </span>
              </button>
              {state !== 'disconnected' && onDisconnect && (
                <button
                  type="button"
                  className={styles.disconnect}
                  aria-label={`${t('disconnect')}: ${account.email}`}
                  data-tooltip={t('disconnect')}
                  onClick={() => {
                    if (window.confirm(t('disconnectConfirm'))) onDisconnect(account.id);
                  }}
                >
                  <UiIcon name="close" size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
