import { useCallback, useEffect, useRef, useState } from 'react';

import { StartupScreen } from '../components/StartupScreen/StartupScreen';
import { TooltipHost } from '../components/Tooltip/TooltipHost';
import { TitleBar } from '../components/TitleBar/TitleBar';
import { useTranslation } from '../lib/i18n/useTranslation';
import { useTheme } from '../lib/theme/useTheme';
import { MailWorkspace } from './MailWorkspace';
import { AccountDialog } from '../components/MailDialogs/AccountDialog';
import { ComposeDialog } from '../components/MailDialogs/ComposeDialog';
import { useMail } from './useMail';
import { useVersion } from './useVersion';
import { WorkspaceSidebar, type MailFolder } from './WorkspaceSidebar';
import styles from './App.module.css';

export function App() {
  const { t: nav } = useTranslation('navigation');
  const { state, retry } = useVersion();
  const { theme, toggleTheme } = useTheme();
  const [startupVisible, setStartupVisible] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<MailFolder>('inbox');
  const [mailDialog, setMailDialog] = useState<'account' | 'compose' | null>(null);
  const mail = useMail(selectedFolder);
  const shellRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const dismissStartup = useCallback(() => setStartupVisible(false), []);

  useEffect(() => {
    // 防止 Tab 穿透开屏；重播仅覆盖界面，不卸载工作台或重新发起连接。
    shellRef.current?.toggleAttribute('inert', startupVisible);
    if (!startupVisible) mainRef.current?.focus({ preventScroll: true });
  }, [startupVisible]);

  return (
    <>
      <TooltipHost />
      <TitleBar
        theme={theme}
        onToggleTheme={toggleTheme}
        startupVisible={startupVisible}
        folderTitle={nav(selectedFolder)}
        mailStatus={
          mail.ready
            ? {
                lastSyncAt: Math.max(
                  0,
                  ...mail.accounts
                    .filter((account) => !mail.accountId || account.id === mail.accountId)
                    .map((account) => account.sync.lastSyncAt),
                ),
                unread: mail.messages.filter((message) => !message.read).length,
              }
            : undefined
        }
      />
      {startupVisible && (
        <StartupScreen loading={state.status === 'loading'} onDismiss={dismissStartup} />
      )}
      <div
        ref={shellRef}
        className={styles.content}
        aria-hidden={startupVisible ? true : undefined}
      >
        <a className={styles['skip-link']} href="#workspace">
          {nav('skipToWorkspace')}
        </a>
        <div className={styles.shell}>
          <WorkspaceSidebar
            theme={theme}
            onToggleTheme={toggleTheme}
            selectedFolder={selectedFolder}
            onSelectFolder={(folder) => {
              mail.resetView();
              setSelectedFolder(folder);
            }}
            accounts={mail.accounts}
            mailReady={mail.ready}
            selectedAccount={mail.accountId}
            onSelectAccount={mail.chooseAccount}
            onAddAccount={mail.ready ? () => setMailDialog('account') : undefined}
            onCompose={
              mail.ready && mail.accounts.some((account) => account.status === 'configured')
                ? () => setMailDialog('compose')
                : undefined
            }
            onDisconnect={mail.disconnectAccount}
            versionInfo={state.status === 'success' ? state.info : undefined}
            connectionState={state}
            onRetryConnection={retry}
            onReplayStartup={() => setStartupVisible(true)}
          />
          <div className={styles.workspace}>
            <main ref={mainRef} id="workspace" className={styles.main} tabIndex={-1}>
              <MailWorkspace mail={mail} />
            </main>
          </div>
        </div>
      </div>
      {mailDialog === 'account' && (
        <AccountDialog onClose={() => setMailDialog(null)} onSaved={mail.refresh} />
      )}
      {mailDialog === 'compose' && (
        <ComposeDialog
          accounts={mail.accounts}
          selectedAccount={mail.accountId}
          onClose={() => setMailDialog(null)}
          onSent={mail.refresh}
        />
      )}
    </>
  );
}
