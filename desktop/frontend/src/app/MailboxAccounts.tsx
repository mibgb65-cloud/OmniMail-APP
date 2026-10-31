import { useId } from 'react';
import { ScrollArea } from '../components/ScrollArea/ScrollArea';
import { UiIcon } from '../components/UiIcon/UiIcon';
import type { AccountSummary } from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { mailboxState, mailboxStateLabels } from './mailboxState';
import { MailboxStatus } from './MailboxStatus';
import styles from './MailboxAccounts.module.css';

interface Props {
  accounts: AccountSummary[];
  selectedAccount: string;
  onSelectAccount?: (id: string) => void;
  onRetryAccount?: (id: string) => Promise<void>;
}

export function MailboxAccounts({
  accounts,
  selectedAccount,
  onSelectAccount,
  onRetryAccount,
}: Props) {
  const { t } = useTranslation('mail');
  const prefix = useId();
  return (
    <ScrollArea className={styles.list} edgeFade>
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
          return (
            <li
              key={account.id}
              className={styles.row}
              data-selected={selectedAccount === account.id}
              data-syncing={state === 'running' || state === 'partial'}
            >
              <button
                type="button"
                className={styles.select}
                aria-pressed={selectedAccount === account.id}
                aria-label={account.displayName || account.email}
                aria-describedby={statusId}
                data-tooltip={account.email}
                onClick={() => onSelectAccount?.(account.id)}
              >
                <span className={styles.identity}>{account.displayName || account.email}</span>
              </button>
              <span id={statusId} className={styles.srOnly}>
                {label}
              </span>
              <MailboxStatus account={account} onRetry={onRetryAccount} />
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
