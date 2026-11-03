import { useEffect, useRef, useState } from 'react';
import type { AccountSummary } from '../../lib/bridge/mail';
import * as api from '../../lib/bridge/tasks';
import {
  todoStatuses,
  type TodoEdit,
  type TodoDetails,
  type SourceView,
} from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { TaskError } from './TaskError';
import styles from './Tasks.module.css';

const initial: TodoEdit = {
  id: '',
  accountId: '',
  version: 0,
  title: '',
  notes: '',
  owner: '',
  due: '',
  status: 'open',
};
export function TodoEditor({
  id,
  accounts,
  onClose,
  onSaved,
}: {
  id: string;
  accounts: AccountSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation('tasks');
  const ref = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController>();
  const pending = useRef(false);
  const [details, setDetails] = useState<TodoDetails>();
  const [input, setInput] = useState<TodoEdit>(initial);
  const [base, setBase] = useState<TodoEdit>(initial);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>(id ? 'loading' : 'ready');
  const [error, setError] = useState<unknown>();
  const [discard, setDiscard] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [source, setSource] = useState<SourceView>();
  const [attempt, setAttempt] = useState(0);
  const exit = useDialogExit(ref, onClose);
  const dirty = JSON.stringify(input) !== JSON.stringify(base);
  const close = () => {
    if (pending.current) return;
    if (dirty && !discard) {
      setDiscard(true);
      return;
    }
    exit.close();
  };
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => {
      request.current?.abort();
      if (node?.open) node.close();
    };
  }, []);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    void api.todoDetail(id, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) {
          setDetails(value);
          setInput(value.item);
          setBase(value.item);
          setStatus('ready');
        }
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason);
          setStatus('ready');
        }
      },
    );
    return () => controller.abort();
  }, [id, attempt]);
  const run = async (operation: (signal: AbortSignal) => Promise<unknown>, closeAfter = true) => {
    if (pending.current) return;
    pending.current = true;
    setStatus('saving');
    setError(undefined);
    const controller = new AbortController();
    request.current = controller;
    try {
      await operation(controller.signal);
      if (!controller.signal.aborted) {
        onSaved();
        if (closeAfter) exit.close();
        else setAttempt((value) => value + 1);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setStatus('ready');
    }
  };
  const readSource = async (sourceID: string) => {
    if (pending.current) return;
    pending.current = true;
    const controller = new AbortController();
    request.current = controller;
    try {
      const value = await api.taskSource(sourceID, controller.signal);
      if (!controller.signal.aborted) setSource(value);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      pending.current = false;
    }
  };
  return (
    <DialogFrame
      ref={ref}
      className={styles.dialog}
      closing={exit.closing}
      aria-label={t(id ? 'edit' : 'create')}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className={styles.header}>
        <h2>{t(id ? 'edit' : 'create')}</h2>
        <button type="button" onClick={close}>
          {t(discard ? 'discard' : 'close')}
        </button>
      </header>
      <div className={`${styles.body} ${styles.stack}`}>
        {error != null && <TaskError error={error} />}
        {discard && dirty && <p role="status">{t('unsaved')}</p>}
        {id && !details && status === 'ready' && (
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              setAttempt((v) => v + 1);
            }}
          >
            {t('refresh')}
          </button>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run((signal) => api.editTodo(input, signal));
          }}
        >
          <fieldset
            className={`${styles.fieldset} ${styles.stack}`}
            disabled={status !== 'ready' || (!!id && !details)}
          >
            <label className={styles.field}>
              {t('titleField')}
              <input
                required
                maxLength={1000}
                value={input.title}
                onChange={(e) => setInput({ ...input, title: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              {t('notes')}
              <textarea
                maxLength={4096}
                value={input.notes}
                onChange={(e) => setInput({ ...input, notes: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              {t('owner')}
              <input
                maxLength={200}
                value={input.owner}
                onChange={(e) => setInput({ ...input, owner: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              {t('due')}
              <input
                maxLength={100}
                value={input.due}
                onChange={(e) => setInput({ ...input, due: e.target.value })}
              />
            </label>
            <p className={styles.hint}>{t('dueHint')}</p>
            <label className={styles.field}>
              {t('status')}
              <select
                value={input.status}
                onChange={(e) => setInput({ ...input, status: e.target.value })}
              >
                {todoStatuses.map((value) => (
                  <option key={value} value={value}>
                    {t(`status_${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              {t('account')}
              <select
                value={input.accountId}
                disabled={!!id}
                onChange={(e) => setInput({ ...input, accountId: e.target.value })}
              >
                <option value="">{t('noAccount')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName || a.email}
                  </option>
                ))}
                {input.accountId && !accounts.some((a) => a.id === input.accountId) && (
                  <option value={input.accountId}>{t('removedAccount')}</option>
                )}
              </select>
            </label>
            <button type="submit" disabled={!input.title.trim()}>
              {t(status === 'saving' ? 'saving' : 'save')}
            </button>
          </fieldset>
        </form>
        {details && (
          <>
            <h3>{t('proposals')}</h3>
            <p className={styles.hint}>{t('proposalHint')}</p>
            {dirty && <p className={styles.hint}>{t('saveFirst')}</p>}
            {details.proposals.map((p) => (
              <section className={`${styles.card} ${styles.stack}`} key={p.id}>
                <strong>{t(`proposal_${p.kind}`)}</strong>
                <p>{p.title}</p>
                <p>{p.reason}</p>
                <p>
                  {t('owner')}: {p.owner || t('keep')} · {t('due')}: {p.due || t('keep')}
                </p>
                <blockquote className={styles.quote}>{p.evidence}</blockquote>
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={dirty || status !== 'ready'}
                    onClick={() =>
                      void run(
                        (signal) => api.resolveTodo(p.id, input.version, true, signal),
                        false,
                      )
                    }
                  >
                    {t('apply')}
                  </button>
                  <button
                    type="button"
                    disabled={dirty || status !== 'ready'}
                    onClick={() =>
                      void run(
                        (signal) => api.resolveTodo(p.id, input.version, false, signal),
                        false,
                      )
                    }
                  >
                    {t('ignore')}
                  </button>
                </div>
              </section>
            ))}
            <h3>{t('evidence')}</h3>
            {!details.sources.length && <p>{t('noSources')}</p>}
            {details.sources.map((s) => (
              <section className={`${styles.card} ${styles.stack}`} key={s.id}>
                <strong>{s.subject}</strong>
                <blockquote className={styles.quote}>{s.evidence}</blockquote>
                {s.available ? (
                  <button type="button" onClick={() => void readSource(s.id)}>
                    {t('viewSource')}
                  </button>
                ) : (
                  <p className={styles.hint}>{t('sourceGone')}</p>
                )}
              </section>
            ))}
            {details.truncated && <p>{t('truncated')}</p>}
            {source && (
              <section className={styles.card} aria-label={t('viewSource')}>
                <h3>{source.source.subject}</h3>
                {!source.source.available && <p>{t('sourceGone')}</p>}
                {source.changed && <p>{t('sourceChanged')}</p>}
                {source.error && <TaskError error={new Error(source.error)} />}
                <pre className={styles.bodytext}>{source.body}</pre>
              </section>
            )}
            <button
              type="button"
              disabled={status !== 'ready' || dirty}
              onClick={() => {
                if (!deleting) {
                  setDeleting(true);
                  return;
                }
                void run((signal) => api.deleteTodo(id, input.version, signal));
              }}
            >
              {t(deleting ? 'confirmDelete' : 'delete')}
            </button>
          </>
        )}
        <p className={styles.hint}>{t('retention')}</p>
      </div>
    </DialogFrame>
  );
}
