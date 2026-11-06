import { useEffect, useState } from 'react';
import { taskRunDetail } from '../../lib/bridge/tasks';
import type { Run, RunDetails } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { TaskError } from './TaskError';
import styles from './Tasks.module.css';

export function TaskRunCard({
  run,
  busy,
  onResume,
}: {
  run: Run;
  busy: boolean;
  onResume: () => void;
}) {
  const { t } = useTranslation('tasks');
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RunDetails>();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void taskRunDetail(run.id, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) {
          setDetail(value);
          setError(undefined);
        }
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) setError(reason);
      },
    );
    return () => controller.abort();
  }, [open, run.id, run.done, run.failed, run.pending, run.unknown, run.state]);
  return (
    <section className={`${styles.card} ${styles.stack}`}>
      <div className={styles.runHeader}>
        <div>
          <strong>{t(`run_${run.kind}`)}</strong>
          <p className={styles.hint}>{run.slot || new Date(run.startedAt).toLocaleString()}</p>
        </div>
        <span className={styles.statusBadge}>{t(`run_${run.state}`)}</span>
      </div>
      {run.syncPending && (
        <p role="status" className={styles.hint}>
          {t('syncing')}
        </p>
      )}
      <div className={styles.runMetrics}>
        <div>
          <strong>
            {run.done} / {run.total}
          </strong>
          <span>{t('metricSaved')}</span>
        </div>
        <div>
          <strong>{run.newTodos}</strong>
          <span>{t('metricNew')}</span>
        </div>
        <div>
          <strong>{run.changes}</strong>
          <span>{t('metricChanges')}</span>
        </div>
      </div>
      {run.failed + run.unknown + run.pending > 0 && (
        <p className={styles.hint}>
          {t('runSummary', {
            total: run.total,
            done: run.done,
            failed: run.failed,
            unknown: run.unknown,
            pending: run.pending,
            newTodos: run.newTodos,
            changes: run.changes,
          })}
        </p>
      )}
      {run.waitingBody + run.remaining > 0 && (
        <p className={styles.hint}>
          {t('remaining', { waiting: run.waitingBody, remaining: run.remaining })}
        </p>
      )}
      {run.error && <TaskError error={new Error(run.error)} />}
      <div className={styles.actions}>
        <button
          type="button"
          data-button-variant="ghost"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {t('details')}
        </button>
        {(run.pending > 0 || run.syncPending) && (
          <button type="button" data-button-variant="secondary" disabled={busy} onClick={onResume}>
            {t('resume')}
          </button>
        )}
      </div>
      {open && (
        <section className={styles.stack} aria-label={t('details')}>
          {error != null && <TaskError error={error} />}
          {!detail && !error && <p>{t('loading')}</p>}
          {detail?.mails.map((mail) => (
            <div key={mail.mailId}>
              <p>
                {mail.subject} · {t(`mail_${mail.state}`)}
              </p>
              {mail.error && <TaskError error={new Error(mail.error)} />}
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
