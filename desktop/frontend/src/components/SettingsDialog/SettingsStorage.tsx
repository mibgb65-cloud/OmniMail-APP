import { useEffect, useState } from 'react';
import { getStorageUsage, type StorageUsage } from '../../lib/bridge/storage';
import { useTranslation } from '../../lib/i18n/useTranslation';
import styles from './SettingsDialog.module.css';

const categories = [
  { key: 'mailDataBytes', label: 'storageMailData', description: 'storageMailDataDescription' },
  {
    key: 'attachmentsBytes',
    label: 'storageAttachments',
    description: 'storageAttachmentsDescription',
  },
  { key: 'logsBytes', label: 'storageLogs', description: 'storageLogsDescription' },
  { key: 'backupsBytes', label: 'storageBackups', description: 'storageBackupsDescription' },
  { key: 'otherBytes', label: 'storageOther', description: 'storageOtherDescription' },
] as const;

type StorageState =
  { status: 'loading' } | { status: 'error' } | { status: 'success'; usage: StorageUsage };

export function formatStorageBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1);
  return `${(bytes / 1024 ** (index + 1)).toFixed(2)} ${units[index]}`;
}

export function SettingsStorage() {
  const { t } = useTranslation('settings');
  const [state, setState] = useState<StorageState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getStorageUsage(controller.signal).then(
      (usage) => {
        if (!controller.signal.aborted) setState({ status: 'success', usage });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [revision]);
  const usage = state.status === 'success' ? state.usage : undefined;
  const total = usage?.totalBytes ?? 0;
  const share = (bytes: number) => `${(total > 0 ? (bytes / total) * 100 : 0).toFixed(1)}%`;
  const summary = usage
    ? categories.map((category) => `${t(category.label)} ${share(usage[category.key])}`).join('，')
    : '';

  return (
    <section
      className={styles.card}
      aria-label={t('storageTitle')}
      aria-busy={state.status === 'loading'}
    >
      <div className={styles['storage-head']}>
        <h3>{t('storageUsage')}</h3>
        <button
          type="button"
          disabled={state.status === 'loading'}
          onClick={() => {
            setState({ status: 'loading' });
            setRevision((value) => value + 1);
          }}
        >
          {t(state.status === 'error' ? 'storageRetry' : 'storageRefresh')}
        </button>
      </div>
      <p className={styles['storage-intro']}>{t('storageDescription')}</p>
      {state.status === 'loading' && (
        <p className={styles['section-description']} role="status">
          {t('storageLoading')}
        </p>
      )}
      {state.status === 'error' && (
        <p className={styles['section-notice']} role="alert">
          {t('storageError')}
        </p>
      )}
      {usage && (
        <>
          <p className={styles['storage-total']}>
            <strong>{formatStorageBytes(total)}</strong>
            <span>{t('storageTotal')}</span>
          </p>
          {total === 0 && <p role="status">{t('storageEmpty')}</p>}
          <div
            className={styles['storage-bar']}
            role="img"
            aria-label={`${t('storageUsage')}：${summary}`}
          >
            {categories
              .filter((category) => usage[category.key] > 0)
              .map((category) => (
                <span
                  key={category.key}
                  data-tone={categories.indexOf(category) + 1}
                  style={{ flexGrow: usage[category.key] }}
                  aria-hidden="true"
                />
              ))}
          </div>
          <ul className={styles['storage-items']}>
            {categories.map((category, index) => (
              <li key={category.key} className={styles['storage-item']}>
                <span className={styles['storage-dot']} data-tone={index + 1} aria-hidden="true" />
                <div className={styles.copy}>
                  <strong>{t(category.label)}</strong>
                  <p>{t(category.description)}</p>
                </div>
                <p className={styles['storage-size']}>
                  <span>{formatStorageBytes(usage[category.key])}</span>
                  <small>{share(usage[category.key])}</small>
                </p>
              </li>
            ))}
          </ul>
          <p className={styles['storage-note']}>{t('storageNote')}</p>
        </>
      )}
    </section>
  );
}
