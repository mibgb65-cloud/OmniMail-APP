import type { VersionInfo } from '../../lib/bridge/app';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './SettingsDialog.module.css';

export function SettingsAccounts({
  accountCount,
  onManage,
}: {
  accountCount?: number;
  onManage?: () => void;
}) {
  const { t } = useTranslation('settings');
  return (
    <section className={styles.card} aria-label={t('accountsTitle')}>
      <div className={styles['section-heading']}>
        <UiIcon name="accounts" size={22} />
        <h3>{t('accountsTitle')}</h3>
      </div>
      <p className={styles['section-description']}>{t('accountsDescription')}</p>
      <div className={styles.row}>
        <div className={styles.copy}>
          <strong>{t('connectedAccounts')}</strong>
          <p>
            {accountCount === undefined
              ? t('accountsUnavailable')
              : t('accountCount', { count: accountCount })}
          </p>
        </div>
        <button type="button" disabled={!onManage} onClick={onManage}>
          {t('manageAccounts')}
        </button>
      </div>
    </section>
  );
}

export function SettingsCapability({ kind }: { kind: 'notifications' | 'ai' }) {
  const { t } = useTranslation('settings');
  return (
    <section className={styles.card} aria-label={t(`${kind}Title`)}>
      <div className={styles['section-heading']}>
        <UiIcon name={kind === 'ai' ? 'sparkles' : 'bell'} size={22} />
        <h3>{t(`${kind}Title`)}</h3>
        <span className={styles['capability-label']}>{t('notAvailable')}</span>
      </div>
      <p className={styles['section-description']}>{t(`${kind}Description`)}</p>
      {kind === 'ai' && (
        <p className={styles['section-description']}>{t('translationAvailable')}</p>
      )}
      <div className={styles['section-notice']}>
        <UiIcon name="about" />
        <p>{t(`${kind}Unavailable`)}</p>
      </div>
    </section>
  );
}

export function SettingsUpdates({ versionInfo }: { versionInfo?: VersionInfo }) {
  const { t } = useTranslation('settings');
  return (
    <section className={styles.card} aria-label={t('updatesTitle')}>
      <div className={styles['section-heading']}>
        <UiIcon name="sync" size={22} />
        <h3>{t('updatesTitle')}</h3>
      </div>
      <p className={styles['section-description']}>{t('updatesDescription')}</p>
      <dl className={styles.metadata}>
        <div>
          <dt>{t('currentVersion')}</dt>
          <dd>{versionInfo?.version ?? t('versionUnknown')}</dd>
        </div>
        <div>
          <dt>{t('updateStatus')}</dt>
          <dd>{t('notAvailable')}</dd>
        </div>
      </dl>
      <div className={styles['section-notice']}>
        <UiIcon name="about" />
        <p>{t('updatesUnavailable')}</p>
      </div>
    </section>
  );
}
