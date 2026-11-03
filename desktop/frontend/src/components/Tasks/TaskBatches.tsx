import { useEffect, useRef, useState } from 'react';
import type { MailSummary } from '../../lib/bridge/mail';
import * as api from '../../lib/bridge/tasks';
import type { Run, RunDetails, TaskPreferences } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { TaskError } from './TaskError';
import styles from './Tasks.module.css';

export function TaskBatches({
  mails,
  runs,
  prefs,
  running,
  onChanged,
}: {
  mails: MailSummary[];
  runs: Run[];
  prefs: TaskPreferences;
  running: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation('tasks');
  const [selected, setSelected] = useState<string[]>([]);
  const [retry, setRetry] = useState(false);
  const [status, setStatus] = useState<'ready' | 'saving' | 'started'>('ready');
  const [error, setError] = useState<unknown>();
  const [detail, setDetail] = useState<RunDetails>();
  const request = useRef<AbortController>();
  const pending = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  const run = async (operation: (signal: AbortSignal) => Promise<unknown>, started = true) => {
    if (pending.current) return;
    pending.current = true;
    setStatus('saving');
    setError(undefined);
    const controller = new AbortController();
    request.current = controller;
    try {
      await operation(controller.signal);
      if (!controller.signal.aborted) {
        setStatus(started ? 'started' : 'ready');
        onChanged();
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason);
        setStatus('ready');
      }
    } finally {
      pending.current = false;
    }
  };
  const show = async (id: string) => {
    if (pending.current) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    try {
      const value = await api.taskRunDetail(id, controller.signal);
      if (!controller.signal.aborted) setDetail(value);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    }
  };
  const selectedVisible = selected.filter((id) => mails.some((mail) => mail.id === id));
  return (
    <div className={styles.stack}>
      <p className={styles.hint}>{t('manualHint')}</p>
      {!prefs.consent && <p role="status">{t('scopeRequired')}</p>}
      {error != null && <TaskError error={error} />}
      <div className={`${styles.card} ${styles.stack}`}>
        {mails.slice(0, 100).map((mail) => (
          <label className={styles.check} key={mail.id}>
            <input
              type="checkbox"
              aria-label={t('select', { subject: mail.subject })}
              checked={selectedVisible.includes(mail.id)}
              disabled={
                !mail.cached ||
                !!mail.bodyErrorCode ||
                status === 'saving' ||
                (!selectedVisible.includes(mail.id) && selectedVisible.length >= prefs.limit)
              }
              onChange={(event) =>
                setSelected((old) =>
                  event.target.checked ? [...old, mail.id] : old.filter((id) => id !== mail.id),
                )
              }
            />
            {mail.subject}
          </label>
        ))}
        <p>{t('selected', { count: selectedVisible.length })}</p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={retry}
            onChange={(event) => setRetry(event.target.checked)}
          />
          {t('retryUnknown')}
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={!prefs.consent || running || status === 'saving' || !selectedVisible.length}
            onClick={() => void run((signal) => api.startTaskBatch(selectedVisible, retry, signal))}
          >
            {t('runSelected')}
          </button>
          <button
            type="button"
            disabled={!prefs.consent || running || status === 'saving'}
            onClick={() => void run((signal) => api.runPendingTasks(signal))}
          >
            {t('runPending')}
          </button>
          <button
            type="button"
            disabled={!running || status === 'saving'}
            onClick={() => void run((signal) => api.stopTasks(signal), false)}
          >
            {t('stop')}
          </button>
        </div>
        <p className={styles.hint}>{t('stopHint')}</p>
        {status === 'started' && <p role="status">{t('started')}</p>}
      </div>
      <h3>{t('runs')}</h3>
      {!runs.length && <p>{t('noRuns')}</p>}
      {runs.map((item) => (
        <section className={`${styles.card} ${styles.stack}`} key={item.id}>
          <strong>
            {t(`run_${item.kind}`)} · {t(`run_${item.state}`)} ·{' '}
            {item.slot || new Date(item.startedAt).toLocaleString()}
          </strong>
          {item.syncPending && <p role="status">{t('syncing')}</p>}
          <p>
            {t('runSummary', {
              total: item.total,
              done: item.done,
              failed: item.failed,
              unknown: item.unknown,
              pending: item.pending,
              newTodos: item.newTodos,
              changes: item.changes,
            })}
          </p>
          <p className={styles.hint}>
            {t('remaining', { waiting: item.waitingBody, remaining: item.remaining })}
          </p>
          {item.error && <TaskError error={new Error(item.error)} />}
          <div className={styles.actions}>
            <button type="button" onClick={() => void show(item.id)}>
              {t('details')}
            </button>
            {(item.pending > 0 || item.syncPending) && (
              <button
                type="button"
                disabled={running || status === 'saving'}
                onClick={() => void run((signal) => api.resumeTasks(item.id, signal))}
              >
                {t('resume')}
              </button>
            )}
          </div>
        </section>
      ))}
      {detail && (
        <section className={`${styles.card} ${styles.stack}`} aria-label={t('details')}>
          <strong>{detail.run.id}</strong>
          {detail.mails.map((mail) => (
            <div key={mail.mailId}>
              <p>
                {mail.subject} · {t(`mail_${mail.state}`)}
              </p>
              {mail.error && <TaskError error={new Error(mail.error)} />}
            </div>
          ))}
        </section>
      )}
      <p className={styles.hint}>{t('unknownHint')}</p>
    </div>
  );
}
