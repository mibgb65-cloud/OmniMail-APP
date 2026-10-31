import { useEffect, useId, useRef, useState } from 'react';
import type { AccountSummary } from '../../lib/bridge/mail';
import { errorKey } from '../../lib/bridge/mail';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { DisconnectAccountDialog } from '../MailDialogs/DisconnectAccountDialog';
import { getProviderLabel } from '../MailDialogs/ProviderSelection';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { UiIcon } from '../UiIcon/UiIcon';
import { MailboxAccountDetails } from './MailboxAccountDetails';
import settings from '../SettingsDialog/SettingsDialog.module.css';
import styles from './MailboxManagementDialog.module.css';

interface Props {
  accounts: AccountSummary[];
  selectedAccount: string;
  onDisconnect?: (id: string) => Promise<void> | void;
  onRetryAccount?: (id: string) => Promise<void>;
  onAddAccount?: () => void;
  onClose: () => void;
}

// 双层确认、异步门禁和关闭后打开向导必须共用生命周期，因此在此集中协调；
// 纯账号详情已拆到独立组件，避免把危险操作状态分散到不同窗口后失去关闭/焦点顺序。
export function MailboxManagementDialog({
  accounts,
  selectedAccount,
  onDisconnect,
  onRetryAccount,
  onAddAccount,
  onClose,
}: Props) {
  const { t } = useTranslation('mail');
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const [managedId, setManagedId] = useState(selectedAccount);
  const [confirmation, setConfirmation] = useState<AccountSummary>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const pending = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const addAfterClose = useRef(false);
  const account = accounts.find((item) => item.id === managedId) ?? accounts[0];
  const { closing, close } = useDialogExit(ref, () => {
    onClose();
    if (addAfterClose.current) onAddAccount?.();
  });
  const requestClose = () => {
    if (!pending.current) close();
  };

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const run = async (operation: () => Promise<void> | void) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
    } catch (error) {
      setError(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    // 子确认框退出后，若操作仍在执行，焦点留在管理窗口而不是禁用的危险按钮上。
    if (!busy && !confirmation && returnFocus.current) {
      const target = returnFocus.current;
      const next = target.isConnected && !target.matches(':disabled') ? target : done.current;
      next?.focus({ preventScroll: true });
      next?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      returnFocus.current = null;
    }
  }, [busy, confirmation]);

  return (
    <>
      <DialogFrame
        ref={ref}
        closing={closing}
        className={styles.dialog}
        aria-label={t('accountManagementTitle')}
        aria-describedby={`${id}-description`}
        aria-busy={busy}
        tabIndex={-1}
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
          const controls = [
            ...(ref.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [tabindex="0"]',
            ) ?? []),
          ];
          const first = controls[0],
            last = controls.at(-1);
          if (!first || !last) {
            event.preventDefault();
            ref.current?.focus();
          } else if (document.activeElement === ref.current) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <p id={`${id}-description`} className={settings['screen-reader-only']}>
          {t('accountManagementDescription')}
        </p>
        <div className={`${settings.layout} ${styles.layout}`}>
          <aside className={styles.navigation} aria-label={t('accountList')}>
            <h3 className={styles.navigationTitle}>{t('accountList')}</h3>
            <ScrollArea className={styles.accountList}>
              {accounts.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={styles.account}
                  aria-label={item.email}
                  data-tooltip={item.email}
                  aria-pressed={account?.id === item.id}
                  disabled={busy}
                  onClick={() => {
                    setManagedId(item.id);
                    setError(undefined);
                  }}
                >
                  <UiIcon name="mailOpen" size={17} />
                  <span>
                    <strong>{item.displayName || item.email}</strong>
                    <small>
                      {item.displayName
                        ? item.email
                        : getProviderLabel({ code: item.providerCode, name: item.providerCode }, t)}
                    </small>
                  </span>
                </button>
              ))}
            </ScrollArea>
            {onAddAccount && (
              <button
                type="button"
                className={styles.add}
                data-button-variant="secondary"
                disabled={busy}
                onClick={() => {
                  addAfterClose.current = true;
                  requestClose();
                }}
              >
                <UiIcon name="addMailbox" size={16} />
                {t('addTitle')}
              </button>
            )}
          </aside>
          <div className={settings.panel}>
            <header className={settings.header}>
              <h2>{t('accountManagementTitle')}</h2>
              <button
                type="button"
                className={settings.close}
                aria-label={t('close')}
                data-tooltip={t('close')}
                disabled={busy}
                onClick={requestClose}
              >
                <UiIcon name="close" />
              </button>
            </header>
            <ScrollArea
              className={settings['body-frame']}
              viewportClassName={`${settings.body} ${styles.body}`}
            >
              {error != null && (
                <p role="alert" className={styles.error}>
                  {t(errorKey(error))}
                </p>
              )}
              {account ? (
                <MailboxAccountDetails
                  key={account.id}
                  account={account}
                  busy={busy}
                  canDisconnect={!!onDisconnect}
                  canSync={!!onRetryAccount}
                  onSync={(trigger) => {
                    returnFocus.current = trigger;
                    if (onRetryAccount) void run(() => onRetryAccount(account.id));
                  }}
                  onDisconnect={(trigger) => {
                    returnFocus.current = trigger;
                    setError(undefined);
                    setConfirmation(account);
                  }}
                />
              ) : (
                <p className={styles.hint}>{t('accountManagementEmpty')}</p>
              )}
            </ScrollArea>
            <footer className={settings.footer}>
              <span role="status">
                {t(busy ? 'accountManagementWorking' : 'accountManagementFooter')}
              </span>
              <button ref={done} type="button" disabled={busy} onClick={requestClose}>
                {t('finishAccountSetup')}
              </button>
            </footer>
          </div>
        </div>
      </DialogFrame>
      {confirmation && (
        <DisconnectAccountDialog
          email={confirmation.email}
          onConfirm={() => {
            if (onDisconnect) void run(() => onDisconnect(confirmation.id));
          }}
          onClose={() => {
            setConfirmation(undefined);
            ref.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}
