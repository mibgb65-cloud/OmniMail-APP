import { useId, useState } from 'react';

import { SearchField } from '../components/SearchField/SearchField';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { useTranslation } from '../lib/i18n/useTranslation';
import styles from './MailToolbar.module.css';

const actions = [
  { label: 'archiveAction', icon: 'archive' },
  { label: 'deleteAction', icon: 'deleted' },
  { label: 'toggleReadAction', icon: 'mailOpen' },
  { label: 'markAllReadAction', icon: 'markAllRead' },
] as const;

export function MailToolbar() {
  const { t } = useTranslation('workspace');
  const previewId = useId();
  // 搜索词只在本地 UI 预览，未接入邮箱检索
  const [query, setQuery] = useState('');

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={t('mailToolbarLabel')}>
      <p id={previewId} className={styles['screen-reader-only']}>
        {t('mailActionsUnavailable')}
      </p>
      <div className={styles['search-controls']}>
        <SearchField
          className={styles.search}
          label={t('searchMail')}
          placeholder={t('searchMailPlaceholder')}
          clearLabel={t('clearSearch')}
          describedBy={previewId}
          value={query}
          onValueChange={setQuery}
        />
        <button
          type="button"
          className={styles['sync-button']}
          aria-label={t('syncAction')}
          title={t('unavailableMailAction', { action: t('syncAction') })}
          disabled
        >
          <UiIcon name="sync" size={16} />
          <span>{t('syncButton')}</span>
        </button>
      </div>
      <div className={styles['mail-controls']}>
        <div className={styles.actions}>
          {actions.map(({ label, icon }) => (
            <button
              key={label}
              type="button"
              className={styles['icon-button']}
              aria-label={t(label)}
              title={t('unavailableMailAction', { action: t(label) })}
              disabled
            >
              <UiIcon name={icon} />
            </button>
          ))}
        </div>
        <span className={styles.count} aria-label={t('mailCountUnavailable')}>
          {t('mailCountPlaceholder')}
        </span>
        <div className={styles.pagination}>
          {(
            [
              ['previousMail', 'previous'],
              ['nextMail', 'next'],
            ] as const
          ).map(([label, icon]) => (
            <button
              key={label}
              type="button"
              className={styles['icon-button']}
              aria-label={t(label)}
              title={t('unavailableMailAction', { action: t(label) })}
              disabled
            >
              <UiIcon name={icon} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
