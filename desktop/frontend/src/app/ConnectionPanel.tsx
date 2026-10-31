import { useTranslation } from '../lib/i18n/useTranslation';
import type { ConnectionState } from './useVersion';
import styles from './App.module.css';

interface ConnectionPanelProps {
  state: ConnectionState;
  onRetry: () => void;
}

export function ConnectionPanel({ state, onRetry }: ConnectionPanelProps) {
  const { t } = useTranslation('connection');
  const { t: common } = useTranslation('common');
  const displayValue = (value: string) => (value === 'unknown' ? common('unknownValue') : value);

  return (
    <section className={styles['connection-panel']} aria-labelledby="connection-title">
      <div className={styles['panel-heading']}>
        <div>
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h2 id="connection-title">{t('title')}</h2>
        </div>
        <button type="button" onClick={onRetry} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? t('checking') : t('check')}
        </button>
      </div>
      {state.status === 'loading' && (
        <>
          <p role="status" className={styles.muted}>
            {t('loading')}
          </p>
          <div className={styles.skeleton} aria-hidden="true" />
        </>
      )}
      {state.status === 'error' && (
        <div role="alert" className={styles.error}>
          <strong>{t('errorTitle')}</strong>
          <p>{t('errorDescription')}</p>
        </div>
      )}
      {state.status === 'success' && (
        <>
          <p role="status" className={styles.success}>
            {t('connected')}
          </p>
          <dl className={styles.metadata}>
            <div>
              <dt>{t('appVersion')}</dt>
              <dd>{state.info.version}</dd>
            </div>
            <div>
              <dt>{t('commit')}</dt>
              <dd>{displayValue(state.info.commit)}</dd>
            </div>
            <div>
              <dt>{t('goVersion')}</dt>
              <dd>{state.info.goVersion}</dd>
            </div>
            <div>
              <dt>{t('platform')}</dt>
              <dd>{state.info.platform}</dd>
            </div>
            <div className={styles['metadata-wide']}>
              <dt>{t('buildTime')}</dt>
              <dd>{displayValue(state.info.buildTime)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
