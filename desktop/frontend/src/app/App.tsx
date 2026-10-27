import { useCallback, useEffect, useRef, useState } from 'react';

import { StartupScreen } from '../components/StartupScreen/StartupScreen';
import { TitleBar } from '../components/TitleBar/TitleBar';
import { useTranslation } from '../lib/i18n/useTranslation';
import { useTheme } from '../lib/theme/useTheme';
import { MailWorkspace } from './MailWorkspace';
import { useVersion } from './useVersion';
import { WorkspaceSidebar, type MailFolder } from './WorkspaceSidebar';
import styles from './App.module.css';

export function App() {
  const { t: nav } = useTranslation('navigation');
  const { state, retry } = useVersion();
  const { theme, toggleTheme } = useTheme();
  const [startupVisible, setStartupVisible] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<MailFolder>('inbox');
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
      <TitleBar
        theme={theme}
        onToggleTheme={toggleTheme}
        startupVisible={startupVisible}
        folderTitle={nav(selectedFolder)}
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
            onSelectFolder={setSelectedFolder}
            versionInfo={state.status === 'success' ? state.info : undefined}
            connectionState={state}
            onRetryConnection={retry}
            onReplayStartup={() => setStartupVisible(true)}
          />
          <div className={styles.workspace}>
            <main ref={mainRef} id="workspace" className={styles.main} tabIndex={-1}>
              <MailWorkspace />
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
