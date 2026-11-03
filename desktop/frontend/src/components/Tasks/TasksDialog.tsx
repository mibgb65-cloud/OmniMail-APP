import { useEffect, useId, useRef, useState } from 'react';
import type { AccountSummary, MailSummary } from '../../lib/bridge/mail';
import * as api from '../../lib/bridge/tasks';
import type { TaskPreferences, Todo, Run } from '../../lib/bridge/taskModels';
import { todoStatuses } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { TaskError } from './TaskError';
import { TaskSettings } from './TaskSettings';
import { TaskBatches } from './TaskBatches';
import { TodoEditor } from './TodoEditor';
import styles from './Tasks.module.css';

interface Data {
  items: Todo[];
  runs: Run[];
  prefs: TaskPreferences;
  state: Awaited<ReturnType<typeof api.taskState>>;
}
export function TasksDialog({
  accounts,
  mails,
  onClose,
}: {
  accounts: AccountSummary[];
  mails: MailSummary[];
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const exit = useDialogExit(ref, onClose);
  const [tab, setTab] = useState<'todos' | 'sources' | 'settings'>('todos');
  const [filter, setFilter] = useState('all');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<unknown>();
  const [editing, setEditing] = useState<string>();
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const [items, runs, prefs, state] = await Promise.all([
          api.listTodos(filter, offset, controller.signal),
          api.taskRuns(controller.signal),
          api.taskPreferences(controller.signal),
          api.taskState(controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setData({ items, runs, prefs, state });
          setError(undefined);
          timer = setTimeout(() => void load(), state.running ? 1500 : 5000);
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason);
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [filter, offset, revision]);
  return (
    <>
      <DialogFrame
        ref={ref}
        className={styles.dialog}
        closing={exit.closing}
        aria-label={t('title')}
        onCancel={(event) => {
          event.preventDefault();
          exit.close();
        }}
      >
        <header className={styles.header}>
          <h2>{t('title')}</h2>
          <div className={styles.actions}>
            <button type="button" onClick={refresh}>
              {t('refresh')}
            </button>
            <button type="button" onClick={exit.close}>
              {t('close')}
            </button>
          </div>
        </header>
        <div className={styles.tabs} role="tablist" aria-label={t('title')}>
          {(['todos', 'sources', 'settings'] as const).map((value) => (
            <button
              type="button"
              role="tab"
              id={`${id}-tab-${value}`}
              aria-controls={`${id}-panel`}
              tabIndex={tab === value ? 0 : -1}
              aria-selected={tab === value}
              key={value}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                const tabs = ['todos', 'sources', 'settings'] as const;
                const index = tabs.indexOf(value);
                const next =
                  event.key === 'ArrowRight'
                    ? tabs[(index + 1) % tabs.length]
                    : event.key === 'ArrowLeft'
                      ? tabs[(index + tabs.length - 1) % tabs.length]
                      : event.key === 'Home'
                        ? tabs[0]
                        : event.key === 'End'
                          ? tabs[2]
                          : undefined;
                if (!next) return;
                event.preventDefault();
                setTab(next);
                document.getElementById(`${id}-tab-${next}`)?.focus();
              }}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <div
          className={`${styles.body} ${styles.stack}`}
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${tab}`}
        >
          {error != null && <TaskError error={error} />}
          {!data && !error && <p role="status">{t('loading')}</p>}
          {data?.state.error && <TaskError error={new Error(data.state.error)} />}
          {tab === 'todos' && (
            <>
              <div className={styles.actions}>
                <label>
                  {t('status')}{' '}
                  <select
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value);
                      setOffset(0);
                    }}
                  >
                    <option value="all">{t('all')}</option>
                    {todoStatuses.map((value) => (
                      <option key={value} value={value}>
                        {t(`status_${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => setEditing('')}>
                  {t('create')}
                </button>
              </div>
              {data && !data.items.length && <p>{t('empty')}</p>}
              {data?.items.map((item) => (
                <button
                  type="button"
                  data-button-variant="secondary"
                  className={styles.item}
                  key={item.id}
                  onClick={() => setEditing(item.id)}
                >
                  <span>
                    {item.title}
                    {item.due && <small> · {item.due}</small>}
                  </span>
                  <span>{t(`status_${item.status}`)}</span>
                </button>
              ))}
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={!offset}
                  onClick={() => setOffset((n) => Math.max(0, n - 100))}
                >
                  {t('previous')}
                </button>
                <button
                  type="button"
                  disabled={data?.items.length !== 100 || offset >= 10000}
                  onClick={() => setOffset((n) => n + 100)}
                >
                  {t('more')}
                </button>
              </div>
              <p className={styles.hint}>{t('retention')}</p>
            </>
          )}
          {tab === 'sources' && data && (
            <TaskBatches
              mails={mails}
              runs={data.runs}
              prefs={data.prefs}
              running={data.state.running}
              onChanged={refresh}
            />
          )}
          {tab === 'settings' && <TaskSettings accounts={accounts} onSaved={refresh} />}
        </div>
      </DialogFrame>
      {editing !== undefined && (
        <TodoEditor
          id={editing}
          accounts={accounts}
          onClose={() => setEditing(undefined)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
