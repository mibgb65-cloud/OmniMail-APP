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

export function MailToolbar({
  onSync,
  syncBusy = false,
  syncState = 'idle',
  count,
  query: controlledQuery,
  onQuery,
}: {
  onSync?: () => void;
  syncBusy?: boolean;
  syncState?: 'idle' | 'running' | 'partial' | 'error';
  count?: number;
  query?: string;
  onQuery?: (query: string) => void;
} = {}) {
  const { t } = useTranslation('workspace');
  const { t: mail } = useTranslation('mail');
  const previewId = useId();
  // 搜索词只在本地 UI 预览，未接入邮箱检索
  const [query, setQuery] = useState('');

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={t('mailToolbarLabel')}>
      <p id={previewId} className={styles['screen-reader-only']}>
        {count === undefined ? t('mailActionsUnavailable') : mail('pageSearchHint')}
      </p>
      <div className={styles['search-controls']}>
        <SearchField
          className={styles.search}
          label={t('searchMail')}
          placeholder={
            count === undefined ? t('searchMailPlaceholder') : mail('pageSearchPlaceholder')
          }
          clearLabel={t('clearSearch')}
          describedBy={previewId}
          value={controlledQuery ?? query}
          onValueChange={onQuery ?? setQuery}
        />
        <button
          type="button"
          className={styles['sync-button']}
          aria-label={t('syncAction')}
          data-tooltip={
            syncState === 'running'
              ? mail('syncCachedHint')
              : syncState === 'partial'
                ? mail('syncMore')
                : syncState === 'error'
                  ? mail('syncFailedHint')
                  : onSync
                    ? t('syncAction')
                    : t('unavailableMailAction', { action: t('syncAction') })
          }
          aria-busy={syncBusy || syncState === 'running'}
          data-syncing={syncBusy || syncState === 'running'}
          disabled={!onSync || syncBusy || syncState === 'running'}
          onClick={onSync}
        >
          <UiIcon name="sync" size={16} />
          <span aria-live="polite">
            {syncBusy || syncState === 'running'
              ? mail('syncButtonRunning')
              : syncState === 'partial'
                ? mail('syncButtonMore')
                : t('syncButton')}
          </span>
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
              data-tooltip={t('unavailableMailAction', { action: t(label) })}
              disabled
            >
              <UiIcon name={icon} />
            </button>
          ))}
        </div>
        <span
          className={styles.count}
          aria-label={count === undefined ? t('mailCountUnavailable') : mail('count', { count })}
        >
          {count === undefined ? t('mailCountPlaceholder') : mail('count', { count })}
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
              data-tooltip={t('unavailableMailAction', { action: t(label) })}
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
