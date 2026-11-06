import { useEffect, useId, useRef, useState } from 'react';
import type { AccountSummary } from '../../lib/bridge/mail';
import * as api from '../../lib/bridge/tasks';
import type { TodoEdit, TodoDetails, SourceView } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { UiIcon } from '../UiIcon/UiIcon';
import { TaskError } from './TaskError';
import { TaskConfirm } from './TaskConfirm';
import { TodoEditFields } from './TodoEditFields';
import { TodoContext } from './TodoContext';
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
  const formId = useId();
  const request = useRef<AbortController>();
  const pending = useRef(false);
  const [details, setDetails] = useState<TodoDetails>();
  const [input, setInput] = useState<TodoEdit>(initial);
  const [base, setBase] = useState<TodoEdit>(initial);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>(id ? 'loading' : 'ready');
  const [error, setError] = useState<unknown>();
  const [confirm, setConfirm] = useState<'discard' | 'delete'>();
  const [source, setSource] = useState<SourceView>();
  const [attempt, setAttempt] = useState(0);
  const exit = useDialogExit(ref, onClose);
  const dirty = JSON.stringify(input) !== JSON.stringify(base);
  const close = () => {
    if (pending.current) return;
    if (dirty) {
      setConfirm('discard');
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
    let reloading = false;
    try {
      await operation(controller.signal);
      if (!controller.signal.aborted) {
        onSaved();
        if (closeAfter) exit.close();
        else {
          reloading = true;
          setStatus('loading');
          setAttempt((value) => value + 1);
        }
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      pending.current = false;
      if (!controller.signal.aborted && !reloading) setStatus('ready');
    }
  };
  const readSource = async (sourceID: string) => {
    if (pending.current) return;
    pending.current = true;
    setStatus('saving');
    const controller = new AbortController();
    request.current = controller;
    try {
      const value = await api.taskSource(sourceID, controller.signal);
      if (!controller.signal.aborted) setSource(value);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setStatus('ready');
    }
  };
  return (
    <>
      <DialogFrame
        ref={ref}
        className={`${styles.dialog} ${styles.editorDialog}`}
        closing={exit.closing}
        aria-label={t(id ? 'edit' : 'create')}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>{t('todos')}</div>
            <h2>{t(id ? 'edit' : 'create')}</h2>
          </div>
          <button
            type="button"
            data-button-variant="ghost"
            className={styles.iconButton}
            disabled={status === 'saving'}
            aria-label={t('close')}
            onClick={close}
          >
            <UiIcon name="close" />
          </button>
        </header>
        <ScrollArea className={styles.contentArea} viewportClassName={styles.body}>
          <div className={styles.stack}>
            {error != null && <TaskError error={error} />}
            {id && !details && status === 'ready' && (
              <button
                type="button"
                data-button-variant="secondary"
                onClick={() => {
                  setStatus('loading');
                  setAttempt((value) => value + 1);
                }}
              >
                {t('refresh')}
              </button>
            )}
            {status === 'loading' && <p role="status">{t('loading')}</p>}
            <div className={details ? styles.editorSections : undefined}>
              <form
                id={formId}
                onSubmit={(event) => {
                  event.preventDefault();
                  void run((signal) => api.editTodo(input, signal));
                }}
              >
                <TodoEditFields
                  input={input}
                  onChange={setInput}
                  accounts={accounts}
                  disabled={status !== 'ready' || (!!id && !details)}
                />
              </form>
              {details && (
                <TodoContext
                  details={details}
                  input={input}
                  dirty={dirty}
                  busy={status !== 'ready'}
                  source={source}
                  onSource={(sourceID) => void readSource(sourceID)}
                  onResolve={(proposalID, accept) =>
                    void run(
                      (signal) => api.resolveTodo(proposalID, input.version, accept, signal),
                      false,
                    )
                  }
                />
              )}
            </div>
          </div>
        </ScrollArea>
        <footer className={styles.editorFooter}>
          <div>
            {details && (
              <button
                type="button"
                data-button-variant="ghost"
                className={styles.dangerLink}
                disabled={status !== 'ready' || dirty}
                onClick={() => setConfirm('delete')}
              >
                <UiIcon name="deleted" />
                {t('delete')}
              </button>
            )}
          </div>
          <div className={styles.actions}>
            {dirty && <span className={styles.hint}>{t('unsavedShort')}</span>}
            <button
              type="button"
              data-button-variant="secondary"
              disabled={status === 'saving'}
              onClick={close}
            >
              {t('back')}
            </button>
            <button
              type="submit"
              form={formId}
              disabled={status !== 'ready' || !input.title.trim() || !dirty}
            >
              {t(status === 'saving' ? 'saving' : 'save')}
            </button>
          </div>
        </footer>
      </DialogFrame>
      {confirm === 'discard' && (
        <TaskConfirm
          title={t('discardTodoTitle')}
          confirm={t('discardTodo')}
          cancel={t('continueEditing')}
          danger
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            setConfirm(undefined);
            exit.close();
          }}
        >
          <p>{t('discardTodoDescription')}</p>
        </TaskConfirm>
      )}
      {confirm === 'delete' && (
        <TaskConfirm
          title={t('deleteTodoTitle')}
          confirm={t('confirmDeleteTodo')}
          cancel={t('back')}
          danger
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            setConfirm(undefined);
            void run((signal) => api.deleteTodo(id, input.version, signal));
          }}
        >
          <p>{t('deleteTodoDescription')}</p>
        </TaskConfirm>
      )}
    </>
  );
}
