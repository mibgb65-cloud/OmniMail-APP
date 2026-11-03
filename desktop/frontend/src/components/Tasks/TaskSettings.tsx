import { useEffect, useRef, useState } from 'react';
import type { AccountSummary } from '../../lib/bridge/mail';
import { aiConfig, type AIConfig } from '../../lib/bridge/ai';
import { taskPreferences, saveTaskPreferences } from '../../lib/bridge/tasks';
import {
  taskFolders,
  type TaskPreferencesInput,
  type TaskPreferences,
} from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { TaskError } from './TaskError';
import styles from './Tasks.module.css';
const folderKeys = {
  inbox: 'folder_inbox',
  archive: 'folder_archive',
  sent: 'folder_sent',
  other: 'folder_otherName',
} as const;

export function TaskSettings({
  accounts,
  onSaved,
}: {
  accounts: AccountSummary[];
  onSaved: () => void;
}) {
  const { t } = useTranslation('tasks');
  const [input, setInput] = useState<TaskPreferencesInput>();
  const [config, setConfig] = useState<AIConfig>();
  const [stored, setStored] = useState<TaskPreferences>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef<AbortController>();
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([taskPreferences(controller.signal), aiConfig(controller.signal)]).then(
      ([prefs, ai]) => {
        if (controller.signal.aborted) return;
        const changed = prefs.aiRevision !== ai.revision;
        setConfig(ai);
        setStored(prefs);
        setInput({
          enabled: changed ? false : prefs.enabled,
          consent: changed ? false : prefs.consent,
          accounts: prefs.accounts,
          folders: prefs.folders,
          time: prefs.time,
          timezone: prefs.revision
            ? prefs.timezone
            : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          limit: prefs.limit,
        });
        setStatus('ready');
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason);
          setStatus('ready');
        }
      },
    );
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [attempt]);
  const scope = (key: 'accounts' | 'folders', value: string, checked: boolean) => {
    setInput(
      (old) =>
        old && {
          ...old,
          [key]: checked ? [...old[key], value] : old[key].filter((item) => item !== value),
          consent: false,
          enabled: false,
        },
    );
    setSaved(false);
  };
  const save = async () => {
    if (!input || pending.current) return;
    pending.current = true;
    setStatus('saving');
    setError(undefined);
    setSaved(false);
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await saveTaskPreferences(input, controller.signal);
      if (!controller.signal.aborted) {
        setStored(result);
        setInput(result);
        setSaved(true);
        onSaved();
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setStatus('ready');
    }
  };
  return (
    <div className={styles.stack}>
      <p className={styles.hint}>{t('scheduleHint')}</p>
      {error != null && <TaskError error={error} />}
      {!input && (
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => {
            setStatus('loading');
            setAttempt((n) => n + 1);
          }}
        >
          {t(status === 'loading' ? 'loading' : 'refresh')}
        </button>
      )}
      {!config?.consent && <p className={styles.hint}>{t('aiRequired')}</p>}
      {stored?.consent && stored.aiRevision !== config?.revision && (
        <p role="status">{t('configChanged')}</p>
      )}
      {input && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className={`${styles.fieldset} ${styles.stack}`} disabled={status !== 'ready'}>
            <fieldset className={styles.fieldset}>
              <legend>{t('accounts')}</legend>
              {accounts.map((account) => (
                <label className={styles.check} key={account.id}>
                  <input
                    type="checkbox"
                    checked={input.accounts.includes(account.id)}
                    onChange={(event) => scope('accounts', account.id, event.target.checked)}
                  />
                  {account.displayName || account.email} · {account.email}
                </label>
              ))}
            </fieldset>
            <fieldset className={styles.fieldset}>
              <legend>{t('folders')}</legend>
              {taskFolders.map((folder) => (
                <label className={styles.check} key={folder}>
                  <input
                    type="checkbox"
                    checked={input.folders.includes(folder)}
                    onChange={(event) => scope('folders', folder, event.target.checked)}
                  />
                  {t(folderKeys[folder])}
                </label>
              ))}
            </fieldset>
            <label className={styles.field}>
              {t('time')}
              <input
                type="time"
                required
                value={input.time}
                onChange={(event) => setInput({ ...input, time: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              {t('timezone')}
              <input
                required
                maxLength={64}
                value={input.timezone}
                onChange={(event) => setInput({ ...input, timezone: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              {t('limit')}
              <input
                type="number"
                min={1}
                max={100}
                required
                value={input.limit}
                onChange={(event) => setInput({ ...input, limit: Number(event.target.value) })}
              />
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={input.consent}
                disabled={!config?.consent || !input.accounts.length || !input.folders.length}
                onChange={(event) =>
                  setInput({
                    ...input,
                    consent: event.target.checked,
                    enabled: event.target.checked && input.enabled,
                  })
                }
              />
              {t('consent', { endpoint: config?.endpoint || '—', model: config?.model || '—' })}
            </label>
            <p className={styles.hint}>{t('consentHint')}</p>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={input.enabled}
                disabled={!input.consent}
                onChange={(event) => setInput({ ...input, enabled: event.target.checked })}
              />
              {t('enabled')}
            </label>
            <p className={styles.hint}>{t('baselineHint')}</p>
            <button type="submit">{t(status === 'saving' ? 'saving' : 'save')}</button>
          </fieldset>
        </form>
      )}
      {saved && <p role="status">{t('saved')}</p>}
    </div>
  );
}
