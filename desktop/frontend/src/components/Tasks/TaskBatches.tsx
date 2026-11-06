import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AccountSummary, MailSummary } from '../../lib/bridge/mail';
import { aiConfig, type AIConfig } from '../../lib/bridge/ai';
import * as api from '../../lib/bridge/tasks';
import type { Run, TaskPreferences } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import { TaskError } from './TaskError';
import { TaskRunCard } from './TaskRunCard';
import styles from './Tasks.module.css';

interface Review {
  kind: 'selection' | 'pending';
  ids: string[];
  revision: string;
  retry: boolean;
  config: AIConfig;
}
export function TaskBatches({
  accounts = [],
  mails,
  runs,
  prefs,
  running,
  onChanged,
  onSettings,
}: {
  accounts?: AccountSummary[];
  mails: MailSummary[];
  runs: Run[];
  prefs: TaskPreferences;
  running: boolean;
  onChanged: () => void;
  onSettings?: () => void;
}) {
  const { t } = useTranslation('tasks');
  const [selected, setSelected] = useState<string[]>([]);
  const [retry, setRetry] = useState(false);
  const [status, setStatus] = useState<'ready' | 'saving' | 'started'>('ready');
  const [error, setError] = useState<unknown>();
  const [review, setReview] = useState<Review>();
  const request = useRef<AbortController>();
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  useLayoutEffect(() => {
    const viewport = root.current?.closest<HTMLElement>('[data-custom-scrollbar]');
    if (viewport) viewport.scrollTop = 0;
  }, [review]);
  const visible = mails.slice(0, 100);
  const eligible = (mail: MailSummary) =>
    mail.cached && !mail.bodyErrorCode && prefs.accounts.includes(mail.accountId);
  const eligibleIDs = visible.filter(eligible).map((mail) => mail.id);
  const selectedIDs = selected.filter((id) => eligibleIDs.includes(id));
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
        setReview(undefined);
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
  const prepare = async (kind: Review['kind']) => {
    if (
      pending.current ||
      running ||
      !prefs.consent ||
      (kind === 'selection' && !selectedIDs.length)
    )
      return;
    pending.current = true;
    setStatus('saving');
    setError(undefined);
    const controller = new AbortController();
    request.current = controller;
    try {
      const config = await aiConfig(controller.signal);
      if (config.revision !== prefs.aiRevision || !config.consent)
        throw new Error('TASK_CONFIG_CHANGED');
      if (kind === 'selection') await api.checkTaskBatch(selectedIDs, retry, controller.signal);
      if (!controller.signal.aborted)
        setReview({
          kind,
          ids: [...selectedIDs],
          revision: prefs.revision,
          retry: kind === 'selection' && retry,
          config,
        });
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setStatus('ready');
    }
  };
  const disabled = status === 'saving' || running;
  return (
    <div ref={root} className={styles.stack}>
      <div className={styles.sectionHeading}>
        <div>
          <h3>{t('batchTitle')}</h3>
          <p className={styles.hint}>{t('batchDescription')}</p>
        </div>
        {onSettings && (
          <button type="button" data-button-variant="secondary" onClick={onSettings}>
            {t('configureScope')}
          </button>
        )}
      </div>
      {!prefs.consent && (
        <div className={styles.notice}>
          <UiIcon name="about" />
          <p>{t('scopeRequired')}</p>
        </div>
      )}
      {error != null && <TaskError error={error} />}
      {!review && (
        <section className={`${styles.card} ${styles.stack}`}>
          <div className={styles.sectionHeading}>
            <strong>{t('selectedLimit', { count: selectedIDs.length, limit: prefs.limit })}</strong>
            <div className={styles.actions}>
              <button
                type="button"
                data-button-variant="ghost"
                disabled={!prefs.consent || disabled || !eligibleIDs.length}
                onClick={() => setSelected(eligibleIDs.slice(0, prefs.limit))}
              >
                {t('selectAvailable')}
              </button>
              <button
                type="button"
                data-button-variant="ghost"
                disabled={!selectedIDs.length || status === 'saving'}
                onClick={() => setSelected([])}
              >
                {t('clearSelection')}
              </button>
            </div>
          </div>
          {!visible.length && <p className={styles.hint}>{t('noLoadedMail')}</p>}
          {!!visible.length && (
            <div className={styles.mailList}>
              {visible.map((mail) => (
                <label className={`${styles.check} ${styles.mailRow}`} key={mail.id}>
                  <input
                    type="checkbox"
                    aria-label={t('select', { subject: mail.subject })}
                    checked={selectedIDs.includes(mail.id)}
                    disabled={
                      !prefs.consent ||
                      !eligible(mail) ||
                      status === 'saving' ||
                      (!selectedIDs.includes(mail.id) && selectedIDs.length >= prefs.limit)
                    }
                    onChange={(event) =>
                      setSelected((old) =>
                        event.target.checked
                          ? [...old, mail.id]
                          : old.filter((id) => id !== mail.id),
                      )
                    }
                  />
                  <span>
                    {mail.subject}
                    <small className={styles.hint}>
                      {' '}
                      · {accounts.find((a) => a.id === mail.accountId)?.displayName || mail.from}
                    </small>
                    {!eligible(mail) && <p className={styles.hint}>{t('unavailableMail')}</p>}
                  </span>
                </label>
              ))}
            </div>
          )}
          <details className={styles.advanced}>
            <summary>{t('advancedRetry')}</summary>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={retry}
                disabled={disabled}
                onChange={(event) => setRetry(event.target.checked)}
              />
              {t('retryUnknown')}
            </label>
          </details>
          <div className={styles.selectionBar}>
            <p className={styles.hint}>{t('manualHint')}</p>
            <div className={styles.actions}>
              <button
                type="button"
                data-button-variant="secondary"
                disabled={!prefs.consent || disabled}
                onClick={() => void prepare('pending')}
              >
                {t('reviewPending')}
              </button>
              <button
                type="button"
                disabled={!prefs.consent || disabled || !selectedIDs.length}
                onClick={() => void prepare('selection')}
              >
                {t('reviewSelected')}
              </button>
            </div>
          </div>
        </section>
      )}
      {review && (
        <section
          className={`${styles.card} ${styles.review} ${styles.stack}`}
          aria-label={t('reviewTitle')}
        >
          <h3>{t('reviewTitle')}</h3>
          <strong>
            {review.kind === 'selection'
              ? t('reviewMailCount', { count: review.ids.length })
              : t('reviewPendingCount', { limit: prefs.limit })}
          </strong>
          <dl>
            <dt>{t('destination')}</dt>
            <dd>
              {review.config.endpoint} · {review.config.model}
            </dd>
            <dt>{t('accounts')}</dt>
            <dd>
              {prefs.accounts
                .map((id) => accounts.find((a) => a.id === id)?.displayName || id)
                .join('、')}
            </dd>
          </dl>
          {review.kind === 'selection' && (
            <ul>
              {review.ids.map((id) => (
                <li key={id}>{mails.find((mail) => mail.id === id)?.subject || id}</li>
              ))}
            </ul>
          )}
          <p className={styles.hint}>{t('reviewContent')}</p>
          {review.retry && <p className={styles.error}>{t('reviewRetryWarning')}</p>}
          {review.revision !== prefs.revision && <p role="alert">{t('reviewChanged')}</p>}
          <div className={styles.actions}>
            <button
              type="button"
              data-button-variant="secondary"
              disabled={status === 'saving'}
              onClick={() => setReview(undefined)}
            >
              {t('cancelReview')}
            </button>
            <button
              type="button"
              disabled={disabled || review.revision !== prefs.revision}
              onClick={() =>
                void run((signal) =>
                  review.kind === 'selection'
                    ? api.startTaskBatch(review.ids, review.retry, signal)
                    : api.runPendingTasks(signal),
                )
              }
            >
              {t(status === 'saving' ? 'saving' : 'confirmAnalysis')}
            </button>
          </div>
        </section>
      )}
      {status === 'started' && (
        <div className={styles.notice} role="status">
          <UiIcon name="check" />
          <p>{t('started')}</p>
        </div>
      )}
      {running && (
        <div className={styles.notice}>
          <UiIcon name="sync" />
          <div className={styles.stack}>
            <strong>{t('backgroundRunning')}</strong>
            <p className={styles.hint}>{t('stopHint')}</p>
            <button
              type="button"
              data-button-variant="secondary"
              disabled={status === 'saving'}
              onClick={() => void run((signal) => api.stopTasks(signal), false)}
            >
              {t('stop')}
            </button>
          </div>
        </div>
      )}
      <div className={styles.sectionHeading}>
        <div>
          <h3>{t('runs')}</h3>
          <p className={styles.hint}>{t('runHistoryDescription')}</p>
        </div>
      </div>
      {!runs.length && <p className={styles.hint}>{t('noRuns')}</p>}
      {runs.map((item) => (
        <TaskRunCard
          key={item.id}
          run={item}
          busy={disabled}
          onResume={() => void run((signal) => api.resumeTasks(item.id, signal))}
        />
      ))}
    </div>
  );
}
