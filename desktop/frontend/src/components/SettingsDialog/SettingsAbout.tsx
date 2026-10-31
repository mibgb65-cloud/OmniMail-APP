import { ConnectionPanel } from '../../app/ConnectionPanel';
import appStyles from '../../app/App.module.css';
import type { ConnectionState } from '../../app/useVersion';
import type { VersionInfo } from '../../lib/bridge/app';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { BrandMark } from '../BrandMark/BrandMark';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './SettingsDialog.module.css';

interface SettingsAboutProps {
  versionInfo?: VersionInfo;
  connectionState?: ConnectionState;
  onRetryConnection?: () => void;
  onReplayStartup?: () => void;
}

export function SettingsAbout({
  versionInfo,
  connectionState,
  onRetryConnection,
  onReplayStartup,
}: SettingsAboutProps) {
  const { t } = useTranslation('settings');
  const { t: common } = useTranslation('common');
  const { t: connection } = useTranslation('connection');
  const { t: workspace } = useTranslation('workspace');
  const display = (value: string) => (value === 'unknown' ? common('unknownValue') : value);

  return (
    <section className={styles.card} aria-label={t('aboutTitle')}>
      <div className={styles['about-identity']}>
        <BrandMark className={styles['about-logo']} />
        <div>
          <strong>OmniMail</strong>
          <p>{common('developmentPreview')}</p>
        </div>
      </div>
      <p className={styles['about-description']}>{common('documentDescription')}</p>
      <div className={styles['development-intro']}>
        <h3>{workspace('title')}</h3>
        <p>{workspace('intro')}</p>
      </div>
      {connectionState && onRetryConnection ? (
        <ConnectionPanel state={connectionState} onRetry={onRetryConnection} />
      ) : versionInfo ? (
        <dl className={styles.metadata}>
          <div>
            <dt>{connection('appVersion')}</dt>
            <dd>{versionInfo.version}</dd>
          </div>
          <div>
            <dt>{connection('platform')}</dt>
            <dd>{versionInfo.platform}</dd>
          </div>
          <div>
            <dt>{connection('goVersion')}</dt>
            <dd>{versionInfo.goVersion}</dd>
          </div>
          <div>
            <dt>{connection('commit')}</dt>
            <dd>{display(versionInfo.commit)}</dd>
          </div>
          <div className={styles['metadata-wide']}>
            <dt>{connection('buildTime')}</dt>
            <dd>{display(versionInfo.buildTime)}</dd>
          </div>
        </dl>
      ) : (
        <p role="status" className={styles['version-unavailable']}>
          {t('versionUnavailable')}
        </p>
      )}
      <section className={styles['development-next']} aria-labelledby="settings-next-title">
        <h3 id="settings-next-title">{workspace('nextTitle')}</h3>
        <p>{workspace('nextDescription')}</p>
        <ol className={styles['development-steps']}>
          <li>
            <strong>{workspace('addAccountTitle')}</strong>
            <p>{workspace('addAccountDescription')}</p>
          </li>
          <li>
            <strong>{workspace('syncTitle')}</strong>
            <p>{workspace('syncDescription')}</p>
          </li>
          <li>
            <strong>{workspace('focusTitle')}</strong>
            <p>{workspace('focusDescription')}</p>
          </li>
        </ol>
      </section>
      <footer className={styles['development-footer']}>
        <span>Wails v3 · Go · React · TypeScript</span>
        {onReplayStartup && (
          <button type="button" className={appStyles.replay} onClick={onReplayStartup}>
            <UiIcon name="replay" className={appStyles.icon} />
            {common('replayAnimation')}
          </button>
        )}
      </footer>
    </section>
  );
}
