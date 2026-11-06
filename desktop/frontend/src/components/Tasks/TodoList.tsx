import type { AccountSummary } from '../../lib/bridge/mail';
import { todoStatuses, type TodoCounts, type TodoStatus } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import { TaskError } from './TaskError';
import type { TodoPage } from './useTaskWorkspace';
import styles from './Tasks.module.css';

export function TodoList({
  page,
  counts,
  error,
  filter,
  offset,
  accounts,
  onFilter,
  onOffset,
  onEdit,
  onSources,
  onRefresh,
}: {
  page?: TodoPage;
  counts?: TodoCounts;
  error?: unknown;
  filter: 'all' | TodoStatus;
  offset: number;
  accounts: AccountSummary[];
  onFilter: (value: 'all' | TodoStatus) => void;
  onOffset: (value: number) => void;
  onEdit: (id: string) => void;
  onSources: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('tasks');
  const total = counts?.[filter] ?? 0;
  const emptyAll = page?.counts.all === 0;
  return (
    <div className={styles.stack}>
      {!emptyAll && (
        <div className={styles.listToolbar}>
          <div className={styles.filters} role="group" aria-label={t('filterTasks')}>
            {(['all', ...todoStatuses] as const).map((status) => (
              <button
                type="button"
                data-button-variant="ghost"
                key={status}
                aria-pressed={filter === status}
                onClick={() => onFilter(status)}
              >
                {t(status === 'all' ? 'all' : `status_${status}`)}
                <span className={styles.filterCount}>{counts?.[status] ?? '—'}</span>
              </button>
            ))}
          </div>
          <button type="button" className={styles.withIcon} onClick={() => onEdit('')}>
            <UiIcon name="addMailbox" />
            {t('create')}
          </button>
        </div>
      )}
      {error != null && (
        <>
          <TaskError error={error} />
          <button type="button" data-button-variant="secondary" onClick={onRefresh}>
            {t('refresh')}
          </button>
        </>
      )}
      {!page && error == null && (
        <div className={styles.loadingRows} aria-label={t('loading')} role="status">
          <span />
          <span />
          <span />
        </div>
      )}
      {emptyAll && (
        <section className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <UiIcon name="check" size={28} />
          </div>
          <h3>{t('emptyTitle')}</h3>
          <p>{t('emptyDescription')}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.withIcon} onClick={() => onEdit('')}>
              <UiIcon name="addMailbox" />
              {t('create')}
            </button>
            <button type="button" data-button-variant="secondary" onClick={onSources}>
              {t('extractFromMail')}
            </button>
          </div>
          <div className={styles.emptyGuide}>
            <span>
              <UiIcon name="accounts" />
              {t('guideScope')}
            </span>
            <span>
              <UiIcon name="sparkles" />
              {t('guideReview')}
            </span>
            <span>
              <UiIcon name="check" />
              {t('guideTrack')}
            </span>
          </div>
        </section>
      )}
      {page && !emptyAll && !page.items.length && (
        <section className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <UiIcon name="filter" size={26} />
          </div>
          <h3>{t('filterEmptyTitle')}</h3>
          <p>{t('filterEmptyDescription')}</p>
          <button type="button" data-button-variant="secondary" onClick={() => onFilter('all')}>
            {t('showAllTasks')}
          </button>
        </section>
      )}
      {!!page?.items.length && (
        <div className={styles.todoList}>
          {page.items.map((item) => (
            <button
              type="button"
              data-button-variant="ghost"
              className={styles.item}
              key={item.id}
              onClick={() => onEdit(item.id)}
            >
              <span className={styles.itemStatusIcon} data-status={item.status}>
                <UiIcon
                  name={
                    item.status === 'done'
                      ? 'check'
                      : item.status === 'suggested'
                        ? 'sparkles'
                        : 'list'
                  }
                />
              </span>
              <span className={styles.itemContent}>
                <strong>{item.title}</strong>
                <span>
                  {item.owner || t('unknownOwner')}
                  {item.due && <> · {item.due}</>} ·{' '}
                  {accounts.find((a) => a.id === item.accountId)?.displayName ||
                    accounts.find((a) => a.id === item.accountId)?.email ||
                    t(item.accountId ? 'removedAccount' : 'noAccount')}
                </span>
              </span>
              <span className={styles.statusBadge} data-status={item.status}>
                {t(`status_${item.status}`)}
              </span>
              <UiIcon name="next" size={16} />
            </button>
          ))}
        </div>
      )}
      {page && total > 100 && (
        <footer className={styles.pagination}>
          <span>
            {t('pageRange', { start: offset + 1, end: offset + page.items.length, total })}
          </span>
          <div className={styles.actions}>
            <button
              type="button"
              data-button-variant="secondary"
              disabled={!offset}
              onClick={() => onOffset(Math.max(0, offset - 100))}
            >
              <UiIcon name="previous" />
              {t('previous')}
            </button>
            <button
              type="button"
              data-button-variant="secondary"
              disabled={offset + page.items.length >= total}
              onClick={() => onOffset(offset + 100)}
            >
              {t('more')}
              <UiIcon name="next" />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
