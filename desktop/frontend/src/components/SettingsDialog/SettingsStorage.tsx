import { useTranslation } from '../../lib/i18n/useTranslation';
import styles from './SettingsDialog.module.css';

// 真实统计接口尚未接入：先按示例数据渲染分布，接入后把 bytes 换成后端返回值即可。
const categories = [
  {
    key: 'mailData',
    label: 'storageMailData',
    description: 'storageMailDataDescription',
    bytes: 648 * 1024 ** 2,
  },
  {
    key: 'attachments',
    label: 'storageAttachments',
    description: 'storageAttachmentsDescription',
    bytes: 336 * 1024 ** 2,
  },
  {
    key: 'index',
    label: 'storageIndex',
    description: 'storageIndexDescription',
    bytes: 152 * 1024 ** 2,
  },
  {
    key: 'logs',
    label: 'storageLogs',
    description: 'storageLogsDescription',
    bytes: 96 * 1024 ** 2,
  },
] as const;

function formatBytes(bytes: number) {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

export function SettingsStorage() {
  const { t } = useTranslation('settings');
  const total = categories.reduce((sum, category) => sum + category.bytes, 0);
  const share = (bytes: number) => `${((bytes / total) * 100).toFixed(1)}%`;
  const summary = categories
    .map((category) => `${t(category.label)} ${share(category.bytes)}`)
    .join('，');

  return (
    <section className={styles.card} aria-label={t('storageTitle')}>
      <div className={styles['storage-head']}>
        <h3>{t('storageUsage')}</h3>
        <span className={styles['storage-preview']}>{t('storagePreview')}</span>
      </div>
      <p className={styles['storage-intro']}>{t('storageDescription')}</p>
      <p className={styles['storage-total']}>
        <strong>{formatBytes(total)}</strong>
        <span>{t('storageTotal')}</span>
      </p>
      <div
        className={styles['storage-bar']}
        role="img"
        aria-label={`${t('storageUsage')}：${summary}`}
      >
        {categories.map((category, index) => (
          <span
            key={category.key}
            data-tone={index + 1}
            style={{ flexGrow: category.bytes }}
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
              <span>{formatBytes(category.bytes)}</span>
              <small>{share(category.bytes)}</small>
            </p>
          </li>
        ))}
      </ul>
      <p className={styles['storage-note']}>{t('storageNote')}</p>
    </section>
  );
}
