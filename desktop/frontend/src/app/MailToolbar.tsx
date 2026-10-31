import { useEffect, useId, useRef, useState } from 'react';

import { SearchField } from '../components/SearchField/SearchField';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { useTranslation } from '../lib/i18n/useTranslation';
import styles from './MailToolbar.module.css';
import type { MailController } from './useMail';
import { DEFAULT_MAIL_VIEW } from './mailView';

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
  controller,
}: {
  onSync?: () => void;
  syncBusy?: boolean;
  syncState?: 'idle' | 'running' | 'partial' | 'error';
  count?: number;
  query?: string;
  onQuery?: (query: string) => void;
  controller?: MailController;
} = {}) {
  const { t } = useTranslation('workspace');
  const { t: mail } = useTranslation('mail');
  const previewId = useId();
  const filters = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !filters.current?.contains(event.target))
        filters.current?.removeAttribute('open');
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  // 搜索词只在本地 UI 预览，未接入邮箱检索
  const [query, setQuery] = useState('');
  const options = controller?.viewOptions ?? DEFAULT_MAIL_VIEW;
  const items = controller?.visibleMessages ?? [];
  const selectedIndex = items.findIndex((message) => message.id === controller?.selected);
  const selected = items[selectedIndex];
  const writable =
    selected &&
    controller?.accounts.some(
      (account) => account.id === selected.accountId && account.status === 'configured',
    );
  const unread = items.filter(
    (message) =>
      !message.read &&
      controller?.accounts.some(
        (account) => account.id === message.accountId && account.status === 'configured',
      ),
  );
  const invoke = (label: (typeof actions)[number]['label']) => {
    if (!controller || controller.actionBusy) return;
    if (label === 'markAllReadAction') void controller.runAction('allRead', unread);
    else if (selected && writable)
      void controller.runAction(
        label === 'archiveAction' ? 'archive' : label === 'deleteAction' ? 'deleted' : 'read',
        [selected],
      );
  };

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
          data-button-variant="secondary"
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
        {controller?.ready && (
          <>
            <details ref={filters} className={styles.filters}>
              <summary
                role="button"
                aria-label={mail('filterMessages')}
                data-tooltip={mail('loadedFilterHint')}
                data-active={options.unreadOnly || options.attachmentsOnly}
                onKeyDown={(event) => {
                  if (event.key === 'Escape')
                    event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                <UiIcon name="filter" size={16} />
                <span>{mail('filterMessages')}</span>
                {(options.unreadOnly || options.attachmentsOnly) && (
                  <span aria-hidden="true">•</span>
                )}
              </summary>
              <div
                className={styles['filter-popover']}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    const details = event.currentTarget.closest('details');
                    details?.removeAttribute('open');
                    details?.querySelector('summary')?.focus();
                  }
                }}
              >
                <strong>{mail('loadedFilterHint')}</strong>
                <label>
                  <input
                    type="checkbox"
                    checked={options.unreadOnly}
                    onChange={(event) =>
                      controller.setViewOptions({ ...options, unreadOnly: event.target.checked })
                    }
                  />
                  {mail('unreadOnly')}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={options.attachmentsOnly}
                    onChange={(event) =>
                      controller.setViewOptions({
                        ...options,
                        attachmentsOnly: event.target.checked,
                      })
                    }
                  />
                  {mail('attachmentsOnly')}
                </label>
                <button
                  type="button"
                  data-button-variant="secondary"
                  onClick={() =>
                    controller.setViewOptions({
                      ...options,
                      unreadOnly: false,
                      attachmentsOnly: false,
                    })
                  }
                >
                  {mail('clearFilters')}
                </button>
              </div>
            </details>
            <button
              type="button"
              data-button-variant="secondary"
              className={styles['sync-button']}
              aria-label={mail(options.oldestFirst ? 'oldestFirst' : 'newestFirst')}
              aria-pressed={options.oldestFirst}
              data-tooltip={mail(options.oldestFirst ? 'sortNewest' : 'sortOldest')}
              onClick={() =>
                controller.setViewOptions({ ...options, oldestFirst: !options.oldestFirst })
              }
            >
              <UiIcon name={options.oldestFirst ? 'sortAscending' : 'sortDescending'} size={16} />
              <span>{mail(options.oldestFirst ? 'oldestFirst' : 'newestFirst')}</span>
            </button>
          </>
        )}
      </div>
      <div className={styles['mail-controls']}>
        {controller?.actionBusy && (
          <span className={styles.count} role="status">
            {mail('updatingMessages')}
          </span>
        )}
        <div className={styles.actions}>
          {actions.map(({ label, icon }) => (
            <button
              key={label}
              type="button"
              data-button-variant="ghost"
              className={styles['icon-button']}
              aria-label={
                label === 'toggleReadAction' && selected
                  ? mail(selected.read ? 'markUnread' : 'markRead')
                  : t(label)
              }
              data-tooltip={
                controller
                  ? label === 'markAllReadAction'
                    ? mail('markLoadedReadHint')
                    : label === 'deleteAction'
                      ? mail('moveTrashHint')
                      : t(label)
                  : t('unavailableMailAction', { action: t(label) })
              }
              disabled={
                !controller ||
                controller.actionBusy ||
                (label === 'markAllReadAction' ? unread.length === 0 : !writable)
              }
              onClick={() => invoke(label)}
            >
              <UiIcon name={icon} />
            </button>
          ))}
        </div>
        <span
          className={styles.count}
          aria-live="polite"
          aria-label={count === undefined ? t('mailCountUnavailable') : mail('count', { count })}
        >
          {count === undefined
            ? t('mailCountPlaceholder')
            : controller && items.length !== count
              ? mail('filteredCount', { count: items.length, total: count })
              : mail('count', { count })}
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
              data-button-variant="ghost"
              className={styles['icon-button']}
              aria-label={t(label)}
              data-tooltip={
                controller ? t(label) : t('unavailableMailAction', { action: t(label) })
              }
              disabled={
                !controller ||
                selectedIndex < 0 ||
                (label === 'previousMail'
                  ? selectedIndex === 0
                  : selectedIndex === items.length - 1)
              }
              onClick={() => {
                const target = items[selectedIndex + (label === 'previousMail' ? -1 : 1)];
                if (target) controller?.setSelected(target.id);
              }}
            >
              <UiIcon name={icon} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
