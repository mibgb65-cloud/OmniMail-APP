import { useEffect, useId, useRef, useState } from 'react';

import type { ConnectionState } from '../../app/useVersion';
import type { VersionInfo } from '../../lib/bridge/app';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { LanguageSwitcher } from '../LanguageSwitcher/LanguageSwitcher';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { UiIcon } from '../UiIcon/UiIcon';
import { SettingsAbout } from './SettingsAbout';
import {
  SettingsNavigation,
  settingsSectionTitles,
  settingsSections,
  type SettingsSection,
} from './SettingsNavigation';
import { SettingsStorage } from './SettingsStorage';
import { SettingsMailImages } from './SettingsMailImages';
import { SettingsMailAppearance } from './SettingsMailAppearance';
import { SettingsAccounts, SettingsCapability, SettingsUpdates } from './SettingsSections';
import { SettingsAppearance, type SettingsAppearanceProps } from './SettingsAppearance';
import { SettingsCloseBehavior } from './SettingsCloseBehavior';
import styles from './SettingsDialog.module.css';

interface SettingsDialogProps extends SettingsAppearanceProps {
  onClose: () => void;
  versionInfo?: VersionInfo;
  connectionState?: ConnectionState;
  onRetryConnection?: () => void;
  onReplayStartup?: () => void;
  accountCount?: number;
  onManageAccounts?: () => void;
}

function SettingsPreferences(appearance: SettingsAppearanceProps) {
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
        <SettingsAppearance {...appearance} />
        <SettingsCloseBehavior />
      </section>
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

// 分类面板、焦点边界与退出后跳转共享模态生命周期，保留在同一装配组件，
// 避免拆散后出现隐藏面板可聚焦、退出未结束就叠加账号窗口的时序问题。
export function SettingsDialog({
  onClose,
  versionInfo,
  connectionState,
  onRetryConnection,
  onReplayStartup,
  accountCount,
  onManageAccounts,
  ...appearance
}: SettingsDialogProps) {
  const { t } = useTranslation('settings');
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const manageAfterClose = useRef(false);
  const pressedBackdrop = useRef(false);
  const [section, setSection] = useState<SettingsSection>('general');
  const { closing, close } = useDialogExit(dialogRef, () => {
    onClose();
    if (manageAfterClose.current) onManageAccounts?.();
  });

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
        // 分类改变后，最后一个可聚焦项也会改变；不能再依赖已移除的底栏按钮。
        const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('*') ?? [])].filter(
          (element) =>
            element.matches('button, input, select, a[href], [tabindex]') &&
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            !element.closest('[hidden]'),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
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
        <SettingsNavigation id={id} section={section} onChange={setSection} />
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
          {settingsSections.map((name) => (
            <ScrollArea
              key={name}
              className={styles['body-frame']}
              viewportClassName={styles.body}
              role="tabpanel"
              id={`${id}-panel-${name}`}
              aria-labelledby={`${id}-tab-${name}`}
              hidden={section !== name}
              tabIndex={0}
            >
              {name === 'general' && <SettingsPreferences {...appearance} />}
              {name === 'accounts' && (
                <SettingsAccounts
                  accountCount={accountCount}
                  onManage={
                    onManageAccounts
                      ? () => {
                          manageAfterClose.current = true;
                          close();
                        }
                      : undefined
                  }
                />
              )}
              {(name === 'notifications' || name === 'ai') && <SettingsCapability kind={name} />}
              {name === 'reading' && (
                <>
                  <section
                    className={`${styles.card} ${styles.preferences}`}
                    aria-label={t('readingTitle')}
                  >
                    <h3>{t('mailAppearance')}</h3>
                    <SettingsMailAppearance />
                  </section>
                  <SettingsMailImages />
                </>
              )}
              {name === 'storage' && section === 'storage' && <SettingsStorage />}
              {name === 'about' && (
                <SettingsAbout
                  versionInfo={versionInfo}
                  connectionState={connectionState}
                  onRetryConnection={onRetryConnection}
                  onReplayStartup={onReplayStartup}
                />
              )}
              {name === 'updates' && <SettingsUpdates versionInfo={versionInfo} />}
            </ScrollArea>
          ))}
        </div>
      </div>
    </DialogFrame>
  );
}
