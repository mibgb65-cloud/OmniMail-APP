import { useCallback, useEffect, useRef, useState } from 'react';

import { StartupScreen } from '../components/StartupScreen/StartupScreen';
import { TooltipHost } from '../components/Tooltip/TooltipHost';
import { TitleBar } from '../components/TitleBar/TitleBar';
import { useTranslation } from '../lib/i18n/useTranslation';
import { useTheme } from '../lib/theme/useTheme';
import { MailWorkspace } from './MailWorkspace';
import { AccountDialog } from '../components/MailDialogs/AccountDialog';
import { WindowCloseManager } from '../components/WindowCloseDialog/WindowCloseManager';
import { MailTranslationProvider } from '../components/MailTranslation/MailTranslationContext';
import { useComposer } from './useComposer';
import { useMail } from './useMail';
import { useVersion } from './useVersion';
import { WorkspaceSidebar, type MailFolder } from './WorkspaceSidebar';
import styles from './App.module.css';
import { useNativeScrollbarActivity } from '../components/ScrollArea/useNativeScrollbarActivity';

export function App() {
  useNativeScrollbarActivity();
  const { t: nav } = useTranslation('navigation');
  const { state, retry } = useVersion();
  const { theme, themePreference, selectTheme, toggleTheme } = useTheme();
  const [startupVisible, setStartupVisible] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<MailFolder>('inbox');
  const [mailDialog, setMailDialog] = useState<'account' | null>(null);
  const mail = useMail(selectedFolder);
  const composer = useComposer(mail.accounts, mail.refresh);
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
            themePreference={themePreference}
            onThemePreferenceChange={selectTheme}
            selectedFolder={selectedFolder}
            onSelectFolder={(folder) => {
              composer.hide();
              mail.resetView();
              setSelectedFolder(folder);
            }}
            accounts={mail.accounts}
            mailReady={mail.ready}
            selectedAccount={mail.accountId}
            onSelectAccount={(id) => {
              composer.hide();
              mail.chooseAccount(id);
            }}
            onAddAccount={mail.ready ? () => setMailDialog('account') : undefined}
            onCompose={
              mail.ready &&
              (composer.hasSession ||
                mail.accounts.some((account) => account.status === 'configured'))
                ? () => composer.open(mail.accountId)
                : undefined
            }
            composePending={composer.hasSession}
            onDisconnect={mail.disconnectAccount}
            onRetryAccount={mail.retryAccount}
            versionInfo={state.status === 'success' ? state.info : undefined}
            connectionState={state}
            onRetryConnection={retry}
            onReplayStartup={() => setStartupVisible(true)}
          />
          <div className={styles.workspace}>
            <main ref={mainRef} id="workspace" className={styles.main} tabIndex={-1}>
              <MailTranslationProvider
                detail={mail.detail}
                selectedId={mail.selected}
                suspended={!!composer.visible}
              >
                <MailWorkspace
                  composer={composer}
                  mail={{
                    ...mail,
                    setSelected: (id) => {
                      composer.hide();
                      mail.setSelected(id);
                    },
                  }}
                />
              </MailTranslationProvider>
            </main>
          </div>
        </div>
      </div>
      {mailDialog === 'account' && (
        <AccountDialog onClose={() => setMailDialog(null)} onSaved={mail.refresh} />
      )}
      <WindowCloseManager />
    </>
  );
}
