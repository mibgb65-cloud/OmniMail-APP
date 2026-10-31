import { useEffect, useId, useRef, useState } from 'react';

import type { ConnectionState } from '../../app/useVersion';
import type { VersionInfo } from '../../lib/bridge/app';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import type { Theme } from '../../lib/theme/theme';
import { LanguageSwitcher } from '../LanguageSwitcher/LanguageSwitcher';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { UiIcon } from '../UiIcon/UiIcon';
import { SettingsAbout } from './SettingsAbout';
import {
  SettingsNavigation,
  settingsSectionTitles,
  type SettingsSection,
} from './SettingsNavigation';
import { SettingsStorage } from './SettingsStorage';
import { SettingsMailImages } from './SettingsMailImages';
import { SettingsMailAppearance } from './SettingsMailAppearance';
import styles from './SettingsDialog.module.css';

interface AppearanceProps {
  theme: Theme;
  onToggleTheme: () => void;
}

interface SettingsDialogProps extends AppearanceProps {
  onClose: () => void;
  versionInfo?: VersionInfo;
  connectionState?: ConnectionState;
  onRetryConnection?: () => void;
  onReplayStartup?: () => void;
}

function SettingsPreferences({ theme, onToggleTheme }: AppearanceProps) {
  const { t } = useTranslation('settings');
  const { t: common } = useTranslation('common');
  return (
    <>
      <section className={`${styles.card} ${styles.preferences}`} aria-label={t('general')}>
        <h3>{t('general')}</h3>
        <div className={styles.row}>
          <div className={styles.copy}>
            <strong>{common('languageLabel')}</strong>
            <p>{t('languageDescription')}</p>
          </div>
          <LanguageSwitcher compact />
        </div>
        <div className={styles.row}>
          <div className={styles.copy}>
            <strong>{t('appearance')}</strong>
            <p>{t('appearanceDescription')}</p>
          </div>
          <div className={styles.appearance}>
            <span>{theme === 'dark' ? t('dark') : t('light')}</span>
            <button
              type="button"
              role="switch"
              className={styles.switch}
              aria-label={common('themeToggle')}
              aria-checked={theme === 'dark'}
              onClick={onToggleTheme}
            >
              <span aria-hidden="true">
                <UiIcon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
              </span>
            </button>
          </div>
        </div>
        <SettingsMailAppearance />
      </section>
      <SettingsMailImages />
    </>
  );
}

function isBackdropPointer(event: {
  target: EventTarget;
  currentTarget: HTMLDialogElement;
  clientX: number;
  clientY: number;
}) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

export function SettingsDialog({
  onClose,
  versionInfo,
  connectionState,
  onRetryConnection,
  onReplayStartup,
  ...appearance
}: SettingsDialogProps) {
  const { t } = useTranslation('settings');
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstControlRef = useRef<HTMLButtonElement>(null);
  const lastControlRef = useRef<HTMLButtonElement>(null);
  const pressedBackdrop = useRef(false);
  const [section, setSection] = useState<SettingsSection>('general');
  const { closing, close } = useDialogExit(dialogRef, onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    // 原生模态层负责背景不可交互、Tab 焦点约束和关闭后的焦点恢复。
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <DialogFrame
      ref={dialogRef}
      closing={closing}
      aria-modal="true"
      aria-label={t('title')}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
        const boundary = event.shiftKey ? firstControlRef.current : lastControlRef.current;
        if (document.activeElement !== boundary) return;
        event.preventDefault();
        const target = event.shiftKey ? lastControlRef.current : firstControlRef.current;
        target?.focus();
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = isBackdropPointer(event);
      }}
      onClick={(event) => {
        const dismiss = pressedBackdrop.current && isBackdropPointer(event);
        pressedBackdrop.current = false;
        if (dismiss) close();
      }}
    >
      <p id={`${id}-description`} className={styles['screen-reader-only']}>
        {t('description')}
      </p>
      <div className={styles.layout}>
        <SettingsNavigation
          id={id}
          section={section}
          onChange={setSection}
          firstControlRef={firstControlRef}
        />
        <div className={styles.panel}>
          <header className={styles.header}>
            <h2>{t(settingsSectionTitles[section])}</h2>
            <button
              type="button"
              className={styles.close}
              aria-label={t('close')}
              data-tooltip={t('close')}
              onClick={close}
            >
              <UiIcon name="close" />
            </button>
          </header>
          <ScrollArea
            className={styles['body-frame']}
            viewportClassName={styles.body}
            role="tabpanel"
            id={`${id}-panel-general`}
            aria-labelledby={`${id}-tab-general`}
            hidden={section !== 'general'}
            tabIndex={0}
          >
            <SettingsPreferences {...appearance} />
          </ScrollArea>
          <ScrollArea
            className={styles['body-frame']}
            viewportClassName={styles.body}
            role="tabpanel"
            id={`${id}-panel-storage`}
            aria-labelledby={`${id}-tab-storage`}
            hidden={section !== 'storage'}
            tabIndex={0}
          >
            <SettingsStorage />
          </ScrollArea>
          <ScrollArea
            className={styles['body-frame']}
            viewportClassName={styles.body}
            role="tabpanel"
            id={`${id}-panel-about`}
            aria-labelledby={`${id}-tab-about`}
            hidden={section !== 'about'}
            tabIndex={0}
          >
            <SettingsAbout
              versionInfo={versionInfo}
              connectionState={connectionState}
              onRetryConnection={onRetryConnection}
              onReplayStartup={onReplayStartup}
            />
          </ScrollArea>
          <footer className={styles.footer}>
            <span>{t('instant')}</span>
            <button ref={lastControlRef} type="button" onClick={close}>
              {t('done')}
            </button>
          </footer>
        </div>
      </div>
    </DialogFrame>
  );
}
