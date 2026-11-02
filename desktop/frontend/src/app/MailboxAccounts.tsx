import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ScrollArea } from '../components/ScrollArea/ScrollArea';
import { UiIcon } from '../components/UiIcon/UiIcon';
import type { AccountSummary } from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { mailboxState, mailboxStateLabels } from './mailboxState';
import { MailboxStatus } from './MailboxStatus';
import styles from './MailboxAccounts.module.css';
import { groupMailboxProviders, MailboxProviderEntries } from './MailboxProviderEntries';
import { getProviderLabel, getProviderIcon } from '../components/MailDialogs/ProviderSelection';

interface Props {
  accounts: AccountSummary[];
  selectedAccount: string;
  onSelectAccount?: (id: string) => void;
  onRetryAccount?: (id: string) => Promise<void>;
  groupByProvider?: boolean;
}

export function MailboxAccounts({
  accounts,
  selectedAccount,
  onSelectAccount,
  onRetryAccount,
  groupByProvider = false,
}: Props) {
  const { t } = useTranslation('mail');
  const prefix = useId();
  const [provider, setProvider] = useState<string | null>(null);
  const groups = groupMailboxProviders(accounts);
  const group = groupByProvider ? groups.find((value) => value.code === provider) : undefined;
  // 组被删除后释放旧层级，避免后续同服务商重加账号时无操作自动钻回内层。
  if (provider && !group) setProvider(null);
  const current = group?.code ?? null;
  const previous = useRef<string | null>(null);
  const focus = useRef<'enter' | 'back' | 'all' | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  const all = useRef<HTMLButtonElement>(null);
  const entries = useRef(new Map<string, HTMLButtonElement>());
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = current;
    if (focus.current === 'enter') back.current?.focus({ preventScroll: true });
    else if (focus.current === 'all') all.current?.focus({ preventScroll: true });
    else if (
      old &&
      !current &&
      (focus.current === 'back' || document.activeElement === document.body)
    ) {
      // 返回的服务商可能在视口外，允许浏览器将焦点项滚动到可见位置。
      (entries.current.get(old) ?? all.current)?.focus();
    }
    focus.current = null;
  }, [current]);
  const shown = group?.accounts ?? accounts;
  const label = group ? getProviderLabel({ code: group.code, name: group.code }, t) : '';
  const icon = group ? getProviderIcon(group.code) : undefined;
  return (
    <div className={styles.browser} data-mailbox-view={groupByProvider ? 'providers' : 'accounts'}>
      {group && (
        <div className={styles.breadcrumb}>
          <button
            type="button"
            ref={back}
            className={styles.back}
            aria-label={t('mailboxProviderBack')}
            data-tooltip={t('mailboxProviderBack')}
            onClick={() => {
              focus.current = 'back';
              setProvider(null);
            }}
          >
            <UiIcon name="previous" size={14} />
            <span>{t('mailboxProviders')}</span>
          </button>
          <span className={styles.groupTitle} data-tooltip={label}>
            {icon && <img src={icon} width={16} height={16} alt="" />}
            <span>{label}</span>
          </span>
        </div>
      )}
      <ScrollArea
        key={
          groupByProvider ? (current ? `provider:${current}` : 'provider-index') : 'account-list'
        }
        className={styles.list}
        edgeFade
      >
        <button
          ref={all}
          type="button"
          className={styles.all}
          aria-pressed={selectedAccount === ''}
          onClick={() => {
            if (group) {
              focus.current = 'all';
              setProvider(null);
            }
            onSelectAccount?.('');
          }}
        >
          <UiIcon name="accounts" size={16} />
          <span>{t('allAccounts')}</span>
        </button>
        {groupByProvider && !group ? (
          <MailboxProviderEntries
            groups={groups}
            selectedAccount={selectedAccount}
            register={(code, node) => {
              if (node) entries.current.set(code, node);
              else entries.current.delete(code);
            }}
            onEnter={(code) => {
              focus.current = 'enter';
              setProvider(code);
            }}
          />
        ) : (
          <ul className={styles.accounts}>
            {shown.map((account, index) => {
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
        )}
      </ScrollArea>
    </div>
  );
}
