import { useTranslation } from '../../lib/i18n/useTranslation';
import type { Theme } from '../../lib/theme/theme';
import { useThemeTransition } from '../../lib/theme/useThemeTransition';
import { LanguageMenu } from '../LanguageSwitcher/LanguageMenu';
import { UiIcon } from '../UiIcon/UiIcon';
import { FolderBubble } from './FolderBubble';
import { useWindowControls } from './useWindowControls';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  theme: Theme;
  onToggleTheme: () => void;
  startupVisible?: boolean;
  folderTitle?: string;
  mailStatus?: { lastSyncAt: number; unread: number };
}

export function TitleBar({
  theme,
  onToggleTheme,
  startupVisible = false,
  folderTitle,
  mailStatus,
}: TitleBarProps) {
  const { t } = useTranslation('common');
  const { t: workspace } = useTranslation('workspace');
  const { t: mail, locale } = useTranslation('mail');
  const { available, maximised, status, perform } = useWindowControls();
  const { toggleThemeWithTransition, isTransitioning } = useThemeTransition(onToggleTheme);
  const maximizeLabel = maximised ? t('windowRestore') : t('windowMaximize');
  const disabled = !available || status === 'pending';

  return (
    <header
      className={`${styles.bar} ${startupVisible ? styles.startup : ''}`}
      aria-label={t('windowBar')}
    >
      <div
        className={styles.drag}
        data-window-drag="true"
        onDoubleClick={() => void perform('maximize')}
      >
        {!startupVisible && folderTitle && (
          <>
            <FolderBubble title={folderTitle} />
            <dl className={styles['status-bubbles']} aria-label={workspace('mailStatusLabel')}>
              <div
                className={styles['status-bubble']}
                title={mailStatus ? mail('statusHint') : workspace('mailStatusUnavailable')}
              >
                <dt>{workspace('lastSyncLabel')}</dt>
                <dd>
                  {mailStatus && mailStatus.lastSyncAt > 0
                    ? new Intl.DateTimeFormat(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(mailStatus.lastSyncAt)
                    : workspace('notSynced')}
                </dd>
              </div>
              <div
                className={styles['status-bubble']}
                title={mailStatus ? mail('statusHint') : workspace('mailStatusUnavailable')}
              >
                <dt>{mailStatus ? mail('pageUnread') : workspace('unreadLabel')}</dt>
                <dd>{mailStatus ? mailStatus.unread : workspace('unreadUnavailable')}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
      <div className={styles.actions}>
        {!startupVisible && (
          <>
            <LanguageMenu />
            <button
              type="button"
              className={styles.tool}
              aria-label={t('themeToggle')}
              aria-pressed={theme === 'dark'}
              aria-disabled={isTransitioning || undefined}
              aria-busy={isTransitioning || undefined}
              title={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
              onClick={toggleThemeWithTransition}
            >
              <UiIcon name={theme === 'dark' ? 'sun' : 'moon'} className={styles.icon} />
            </button>
          </>
        )}
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            aria-label={t('windowMinimize')}
            title={available ? t('windowMinimize') : t('windowPreviewOnly')}
            disabled={disabled}
            onClick={() => void perform('minimize')}
          >
            <UiIcon name="minimize" className={styles.icon} />
          </button>
          <button
            type="button"
            className={styles.control}
            aria-label={maximizeLabel}
            title={available ? maximizeLabel : t('windowPreviewOnly')}
            disabled={disabled}
            onClick={() => void perform('maximize')}
          >
            <UiIcon name={maximised ? 'restore' : 'maximize'} className={styles.icon} />
          </button>
          <button
            type="button"
            className={`${styles.control} ${styles.close}`}
            aria-label={t('windowClose')}
            title={available ? t('windowClose') : t('windowPreviewOnly')}
            disabled={disabled}
            onClick={() => void perform('close')}
          >
            <UiIcon name="close" className={styles.icon} />
          </button>
        </div>
      </div>
      {status === 'error' && (
        <p role="alert" className={styles.error}>
          {t('windowActionError')}
        </p>
      )}
    </header>
  );
}
