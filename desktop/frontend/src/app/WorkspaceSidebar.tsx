import { useId, useLayoutEffect, useRef, useState } from 'react';

import { BrandMark } from '../components/BrandMark/BrandMark';
import { MessagesPopover } from '../components/MessagesPopover/MessagesPopover';
import { SettingsDialog } from '../components/SettingsDialog/SettingsDialog';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { ScrollArea } from '../components/ScrollArea/ScrollArea';
import type { AccountSummary } from '../lib/bridge/mail';
import { errorKey } from '../lib/bridge/mail';
import type { VersionInfo } from '../lib/bridge/app';
import { useTranslation } from '../lib/i18n/useTranslation';
import type { Theme } from '../lib/theme/theme';
import styles from './App.module.css';
import type { ConnectionState } from './useVersion';

const mailFolders = [
  { name: 'inbox', icon: 'inbox' },
  { name: 'starred', icon: 'starred' },
  { name: 'sent', icon: 'sent' },
  { name: 'drafts', icon: 'drafts' },
  { name: 'archive', icon: 'archive' },
  { name: 'deleted', icon: 'deleted' },
] as const;

export type MailFolder = (typeof mailFolders)[number]['name'];

interface WorkspaceSidebarProps {
  theme: Theme;
  onToggleTheme: () => void;
  versionInfo?: VersionInfo;
  connectionState?: ConnectionState;
  onRetryConnection?: () => void;
  onReplayStartup?: () => void;
  selectedFolder: MailFolder;
  onSelectFolder: (folder: MailFolder) => void;
  accounts?: AccountSummary[];
  selectedAccount?: string;
  onSelectAccount?: (id: string) => void;
  onAddAccount?: () => void;
  onCompose?: () => void;
  onDisconnect?: (id: string) => void;
}

export function WorkspaceSidebar({
  theme,
  onToggleTheme,
  versionInfo,
  connectionState,
  onRetryConnection,
  onReplayStartup,
  selectedFolder,
  onSelectFolder,
  accounts = [],
  selectedAccount = '',
  onSelectAccount,
  onAddAccount,
  onCompose,
  onDisconnect,
}: WorkspaceSidebarProps) {
  const { t, locale } = useTranslation('navigation');
  const { t: mail } = useTranslation('mail');
  const composeStatusId = useId();
  const mailboxLabelId = useId();
  const mailboxStatusId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const folderRefs = useRef(new Map<MailFolder, HTMLButtonElement>());

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    const indicator = indicatorRef.current;
    if (!navigation || !indicator) return;
    let disposed = false;
    const updateIndicator = () => {
      if (disposed) return;
      const button = folderRefs.current.get(selectedFolder);
      if (!button) return;
      const bounds = button.getBoundingClientRect();
      const container = navigation.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      indicator.style.transform = `translateY(${bounds.top - container.top}px)`;
      indicator.style.height = `${bounds.height}px`;
      indicator.dataset.positioned = 'true';
    };
    updateIndicator();

    // 首次先绘制正确位置，之后才启用过渡，避免从导航顶部滑入。
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        indicator.dataset.animate = 'true';
      });
    });
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(updateIndicator) : undefined;
    observer?.observe(navigation);
    folderRefs.current.forEach((button) => observer?.observe(button));
    window.addEventListener('resize', updateIndicator);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', updateIndicator);
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [selectedFolder, locale]);

  return (
    <aside className={styles.sidebar} aria-label={t('applicationLabel')} data-tooltip-side="right">
      <div className={styles.brand}>
        <BrandMark className={styles['brand-mark']} />
        <strong>OmniMail</strong>
      </div>
      <button
        type="button"
        className={styles['compose-button']}
        aria-label={t('compose')}
        aria-describedby={composeStatusId}
        data-tooltip={onCompose ? t('compose') : t('composeUnavailable')}
        disabled={!onCompose}
        onClick={onCompose}
      >
        <span className={styles['nav-label']}>
          <UiIcon name="compose" className={styles.icon} />
          {t('compose')}
        </span>
        {!onCompose && <small id={composeStatusId}>{t('pending')}</small>}
      </button>
      <p className={styles['sidebar-label']}>{t('workspaceLabel')}</p>
      <nav ref={navigationRef} className={styles['mail-navigation']} aria-label={t('primaryLabel')}>
        <div ref={indicatorRef} className={styles['nav-indicator']} aria-hidden="true" />
        <ul className={styles['nav-pending']}>
          {mailFolders.map(({ name, icon }) => (
            <li key={name}>
              <button
                type="button"
                ref={(node) => {
                  if (node) folderRefs.current.set(name, node);
                  else folderRefs.current.delete(name);
                }}
                data-folder={name}
                aria-pressed={selectedFolder === name}
                data-tooltip={t('folderPreview')}
                onClick={() => onSelectFolder(name)}
              >
                <UiIcon name={icon} className={styles.icon} selected={selectedFolder === name} />
                {t(name)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section className={styles['mailbox-section']} aria-labelledby={mailboxLabelId}>
        <p id={mailboxLabelId} className={styles['sidebar-label']}>
          {t('mailboxesLabel')}
        </p>
        {accounts.length > 0 ? (
          <ScrollArea className={styles['mailbox-accounts']}>
            <button
              type="button"
              className={styles['mailbox-account']}
              aria-pressed={selectedAccount === ''}
              onClick={() => onSelectAccount?.('')}
            >
              {mail('allAccounts')}
            </button>
            {accounts.map((account) => (
              <div key={account.id} className={styles['mailbox-account-row']}>
                <button
                  type="button"
                  className={styles['mailbox-account']}
                  aria-pressed={selectedAccount === account.id}
                  data-tooltip={account.email}
                  onClick={() => onSelectAccount?.(account.id)}
                >
                  <span>{account.displayName || account.email}</span>
                  <small>
                    {account.status === 'disconnected'
                      ? mail('disconnected')
                      : account.sync.running
                        ? mail('syncing')
                        : account.sync.errorCode
                          ? mail(errorKey(account.sync.errorCode))
                          : account.sync.more
                            ? mail('syncMore')
                            : account.email}
                  </small>
                </button>
                {account.status !== 'disconnected' && (
                  <button
                    type="button"
                    aria-label={`${mail('disconnect')}: ${account.email}`}
                    data-tooltip={mail('disconnect')}
                    onClick={() => {
                      if (window.confirm(mail('disconnectConfirm'))) onDisconnect?.(account.id);
                    }}
                  >
                    <UiIcon name="close" size={14} />
                  </button>
                )}
              </div>
            ))}
          </ScrollArea>
        ) : (
          <p className={styles['mailbox-empty']}>
            <UiIcon name="mailOpen" className={styles.icon} />
            <span>{t('mailboxesEmpty')}</span>
          </p>
        )}
        <button
          type="button"
          className={styles['mailbox-add']}
          aria-label={t('addMailbox')}
          aria-describedby={mailboxStatusId}
          data-tooltip={onAddAccount ? t('addMailbox') : t('addMailboxUnavailable')}
          disabled={!onAddAccount}
          onClick={onAddAccount}
        >
          <span className={styles['nav-label']}>
            <UiIcon name="addMailbox" className={styles.icon} />
            {t('addMailbox')}
          </span>
          {!onAddAccount && <small id={mailboxStatusId}>{t('pending')}</small>}
        </button>
      </section>
      <div className={styles['sidebar-footer']}>
        <button
          type="button"
          className={styles['settings-button']}
          aria-label={t('settings')}
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          data-tooltip={t('settings')}
          onClick={() => setSettingsOpen(true)}
        >
          <span className={styles['nav-label']}>
            <UiIcon name="settings" className={styles.icon} selected={settingsOpen} />
            {t('settings')}
          </span>
        </button>
        <MessagesPopover />
      </div>
      {settingsOpen && (
        <SettingsDialog
          theme={theme}
          onToggleTheme={onToggleTheme}
          versionInfo={versionInfo}
          connectionState={connectionState}
          onRetryConnection={onRetryConnection}
          onReplayStartup={
            onReplayStartup
              ? () => {
                  setSettingsOpen(false);
                  onReplayStartup();
                }
              : undefined
          }
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </aside>
  );
}
