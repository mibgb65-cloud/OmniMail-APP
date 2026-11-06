import { useId } from 'react';
import type { AccountSummary } from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { getProviderIcon, getProviderLabel } from '../components/MailDialogs/ProviderSelection';
import { UiIcon } from '../components/UiIcon/UiIcon';
import styles from './MailboxAccounts.module.css';

export interface MailboxProviderGroup {
  code: string;
  accounts: AccountSummary[];
}

export function groupMailboxProviders(accounts: AccountSummary[]) {
  const groups = new Map<string, MailboxProviderGroup>();
  for (const account of accounts) {
    // 与添加向导保持相同网易品牌语义；其余只信任存储的服务商代码，不按地址猜品牌。
    const code = account.providerCode === 'netease_126' ? 'netease_163' : account.providerCode;
    const group = groups.get(code);
    if (group) group.accounts.push(account);
    else groups.set(code, { code, accounts: [account] });
  }
  return [...groups.values()];
}

export function MailboxProviderEntries({
  groups,
  selectedAccount,
  onEnter,
  register,
}: {
  groups: MailboxProviderGroup[];
  selectedAccount: string;
  onEnter: (code: string) => void;
  register: (code: string, button: HTMLButtonElement | null) => void;
}) {
  const { t } = useTranslation('mail');
  const id = useId();
  return (
    <ul className={styles.accounts} aria-label={t('mailboxProviders')}>
      {groups.map((group, index) => {
        const label = getProviderLabel({ code: group.code, name: group.code }, t);
        const icon = getProviderIcon(group.code);
        const selected = group.accounts.some((account) => account.id === selectedAccount);
        return (
          <li key={group.code}>
            <button
              type="button"
              className={styles.provider}
              ref={(node) => register(group.code, node)}
              aria-label={t('mailboxProviderEnter', { provider: label })}
              aria-describedby={`${id}-${index}`}
              aria-current={selected ? 'true' : undefined}
              data-provider-selected={selected}
              data-tooltip={t('mailboxProviderEnter', { provider: label })}
              onClick={() => onEnter(group.code)}
            >
              {icon ? (
                <img src={icon} alt="" width={18} height={18} />
              ) : (
                <UiIcon name={group.code === 'custom' ? 'general' : 'mailOpen'} size={18} />
              )}
              <span className={styles.providerName}>{label}</span>
              {selected && <UiIcon name="check" size={13} />}
              <span className={styles.count} aria-hidden="true">
                {group.accounts.length}
              </span>
              <UiIcon name="next" size={13} />
            </button>
            <span id={`${id}-${index}`} className={styles.srOnly}>
              {t('mailboxProviderCount', { count: group.accounts.length })}
              {selected ? ` · ${t('mailboxProviderSelected')}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
