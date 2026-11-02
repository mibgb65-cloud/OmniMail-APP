import { useId, useLayoutEffect, useRef, useState } from 'react';

import { BrandMark } from '../components/BrandMark/BrandMark';
import { MessagesPopover } from '../components/MessagesPopover/MessagesPopover';
import { SettingsDialog } from '../components/SettingsDialog/SettingsDialog';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { MailboxAccounts } from './MailboxAccounts';
import { MailboxManagementDialog } from '../components/MailboxManagementDialog/MailboxManagementDialog';
import type { AccountSummary } from '../lib/bridge/mail';
import type { VersionInfo } from '../lib/bridge/app';
import { useTranslation } from '../lib/i18n/useTranslation';
import type { ThemePreference } from '../lib/theme/theme';
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
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => boolean;
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
  composePending?: boolean;
  onDisconnect?: (id: string) => Promise<void> | void;
  onRetryAccount?: (id: string) => Promise<void>;
  mailReady?: boolean;
}

export function WorkspaceSidebar({
  themePreference,
  onThemePreferenceChange,
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
  composePending = false,
  onDisconnect,
  onRetryAccount,
  mailReady = false,
}: WorkspaceSidebarProps) {
  const { t, locale } = useTranslation('navigation');
  const { t: mail } = useTranslation('mail');
  const composeStatusId = useId();
  const mailboxLabelId = useId();
  const mailboxStatusId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [groupByProvider, setGroupByProvider] = useState(false);
  const manageAccountsRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const folderRefs = useRef(new Map<MailFolder, HTMLButtonElement>());
  // 撰写能力已接入：禁用只表示当前没有可用邮箱，或邮箱仍在加载，不能说成“待开发”。
  const composeDisabledHint = mailReady ? t('composeNeedsMailbox') : t('mailLoading');

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
        aria-label={t(composePending ? 'resumeCompose' : 'compose')}
        aria-describedby={!onCompose ? composeStatusId : undefined}
        data-tooltip={
          onCompose ? t(composePending ? 'resumeCompose' : 'compose') : composeDisabledHint
        }
        disabled={!onCompose}
        onClick={onCompose}
      >
        <span className={styles['nav-label']}>
          <UiIcon name="compose" className={styles.icon} />
          {t(composePending ? 'resumeCompose' : 'compose')}
        </span>
        {!onCompose && <small id={composeStatusId}>{composeDisabledHint}</small>}
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
                data-tooltip={mailReady ? t('folderOpen', { folder: t(name) }) : t('folderPreview')}
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
        <div className={styles['mailbox-header']}>
          <p id={mailboxLabelId} className={styles['sidebar-label']}>
            {t('mailboxesLabel')}
          </p>
          <div className={styles['mailbox-tools']}>
            <button
              type="button"
              className={styles['mailbox-settings']}
              aria-label={mail('mailboxProviderView')}
              aria-pressed={groupByProvider}
              data-tooltip={mail(groupByProvider ? 'mailboxShowAccounts' : 'mailboxShowProviders')}
              disabled={!accounts.length}
              onClick={() => setGroupByProvider((value) => !value)}
            >
              <UiIcon name={groupByProvider ? 'list' : 'providers'} size={14} />
            </button>
            <button
              ref={manageAccountsRef}
              type="button"
              className={styles['mailbox-settings']}
              aria-label={mail('manageAccounts')}
              data-tooltip={mail('manageAccounts')}
              aria-haspopup="dialog"
              aria-expanded={accountsOpen}
              disabled={!mailReady && accounts.length === 0}
              onClick={() => setAccountsOpen(true)}
            >
              <UiIcon name="settings" size={14} />
            </button>
          </div>
        </div>
        {accounts.length > 0 ? (
          <MailboxAccounts
            key={groupByProvider ? 'providers' : 'accounts'}
            groupByProvider={groupByProvider}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelectAccount={onSelectAccount}
            onRetryAccount={onRetryAccount}
          />
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
          aria-describedby={!onAddAccount ? mailboxStatusId : undefined}
          data-tooltip={onAddAccount ? t('addMailbox') : t('mailLoading')}
          disabled={!onAddAccount}
          onClick={onAddAccount}
        >
          <span className={styles['nav-label']}>
            <UiIcon name="addMailbox" className={styles.icon} />
            {t('addMailbox')}
          </span>
          {!onAddAccount && <small id={mailboxStatusId}>{t('mailLoading')}</small>}
        </button>
      </section>
      {accountsOpen && (
        <MailboxManagementDialog
          accounts={accounts}
          selectedAccount={selectedAccount}
          onDisconnect={onDisconnect}
          onRetryAccount={onRetryAccount}
          onAddAccount={onAddAccount}
          onClose={() => {
            setAccountsOpen(false);
            manageAccountsRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
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
          themePreference={themePreference}
          accountCount={mailReady ? accounts.length : undefined}
          onManageAccounts={mailReady ? () => setAccountsOpen(true) : undefined}
          onThemePreferenceChange={onThemePreferenceChange}
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
