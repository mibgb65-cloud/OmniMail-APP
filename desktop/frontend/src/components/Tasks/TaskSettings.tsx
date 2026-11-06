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
import { UiIcon } from '../UiIcon/UiIcon';
import { TaskConfirm } from './TaskConfirm';
import { TaskError } from './TaskError';
import styles from './Tasks.module.css';

const folderKeys = {
  inbox: 'folder_inbox',
  archive: 'folder_archive',
  sent: 'folder_sent',
  other: 'folder_otherName',
} as const;
function settingsKey(value: TaskPreferencesInput) {
  return JSON.stringify({
    enabled: value.enabled,
    consent: value.consent,
    accounts: [...value.accounts].sort(),
    folders: [...value.folders].sort(),
    time: value.time,
    timezone: value.timezone,
    limit: value.limit,
  });
}
export function TaskSettings({
  accounts,
  onSaved,
  running = false,
  onDirtyChange,
  onBusyChange,
}: {
  accounts: AccountSummary[];
  onSaved: () => void;
  running?: boolean;
  onDirtyChange?: (value: boolean) => void;
  onBusyChange?: (value: boolean) => void;
}) {
  const { t } = useTranslation('tasks');
  const [input, setInput] = useState<TaskPreferencesInput>();
  const [base, setBase] = useState<TaskPreferencesInput>();
  const [config, setConfig] = useState<AIConfig>();
  const [stored, setStored] = useState<TaskPreferences>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [scopeChanged, setScopeChanged] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const request = useRef<AbortController>();
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([taskPreferences(controller.signal), aiConfig(controller.signal)]).then(
      ([prefs, ai]) => {
        if (controller.signal.aborted) return;
        const changed = prefs.aiRevision !== ai.revision;
        const form: TaskPreferencesInput = {
          enabled: changed ? false : prefs.enabled,
          consent: changed ? false : prefs.consent,
          accounts: prefs.accounts,
          folders: prefs.folders,
          time: prefs.time,
          timezone: prefs.revision
            ? prefs.timezone
            : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          limit: prefs.limit,
        };
        setConfig(ai);
        setStored(prefs);
        setInput(form);
        setBase(form);
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
  const dirty = !!input && !!base && settingsKey(input) !== settingsKey(base);
  const changedConfig = !!stored?.consent && stored.aiRevision !== config?.revision;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(status === 'saving');
  }, [status, onBusyChange]);
  useEffect(
    () => () => {
      onDirtyChange?.(false);
      onBusyChange?.(false);
    },
    [onDirtyChange, onBusyChange],
  );
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
    setScopeChanged(true);
  };
  const save = async (confirmed = false) => {
    if (!input || pending.current || (!dirty && !changedConfig)) return;
    if (running && !confirmed) {
      setConfirm(true);
      return;
    }
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
        setBase(result);
        setSaved(true);
        setScopeChanged(false);
        onSaved();
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setStatus('ready');
    }
  };
  const saveLabel = input?.enabled
    ? 'saveDaily'
    : stored?.consent && !input?.consent
      ? 'saveRevoke'
      : 'saveSettings';
  return (
    <div className={styles.stack}>
      <div className={styles.notice}>
        <UiIcon name="monitor" />
        <p className={styles.hint}>{t('scheduleHint')}</p>
      </div>
      {error != null && <TaskError error={error} />}
      {!input && (
        <button
          type="button"
          data-button-variant="secondary"
          disabled={status === 'loading'}
          onClick={() => {
            setStatus('loading');
            setAttempt((n) => n + 1);
          }}
        >
          {t(status === 'loading' ? 'loading' : 'refresh')}
        </button>
      )}
      {!config?.consent && (
        <div className={styles.notice}>
          <UiIcon name="about" />
          <p>{t('aiRequired')}</p>
        </div>
      )}
      {changedConfig && (
        <p role="status" className={styles.error}>
          {t('configChanged')}
        </p>
      )}
      {input && (
        <form
          className={styles.stack}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className={`${styles.fieldset} ${styles.stack}`} disabled={status !== 'ready'}>
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <h3>{t('settingsScopeTitle')}</h3>
                  <p className={styles.hint}>{t('settingsScopeDescription')}</p>
                </div>
              </div>
              <fieldset className={styles.fieldset}>
                <legend>{t('accounts')}</legend>
                <div className={styles.optionGrid}>
                  {accounts.map((account) => (
                    <label className={`${styles.check} ${styles.option}`} key={account.id}>
                      <input
                        type="checkbox"
                        checked={input.accounts.includes(account.id)}
                        onChange={(event) => scope('accounts', account.id, event.target.checked)}
                      />
                      <span>
                        {account.displayName || account.email}
                        <small>{account.email}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className={styles.fieldset}>
                <legend>{t('folders')}</legend>
                <div className={styles.optionGrid}>
                  {taskFolders.map((folder) => (
                    <label className={`${styles.check} ${styles.option}`} key={folder}>
                      <input
                        type="checkbox"
                        checked={input.folders.includes(folder)}
                        onChange={(event) => scope('folders', folder, event.target.checked)}
                      />
                      {t(folderKeys[folder])}
                    </label>
                  ))}
                </div>
              </fieldset>
              {scopeChanged && (
                <p className={styles.hint} role="status">
                  {t('scopeChanged')}
                </p>
              )}
            </section>
            <section className={`${styles.formSection} ${styles.stack}`}>
              <div className={styles.sectionHeading}>
                <div>
                  <h3>{t('settingsScheduleTitle')}</h3>
                  <p className={styles.hint}>{t('settingsScheduleDescription')}</p>
                </div>
                <span className={styles.statusBadge}>
                  {t(input.enabled ? 'dailyEnabled' : 'dailyDisabled')}
                </span>
              </div>
              <div className={styles.formGrid}>
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
              </div>
            </section>
            <section className={`${styles.formSection} ${styles.stack}`}>
              <h3>{t('settingsPermissionTitle')}</h3>
              <div className={styles.notice}>
                <UiIcon name="globe" />
                <div>
                  <strong>{config?.model || '—'}</strong>
                  <p className={styles.hint}>{config?.endpoint || '—'}</p>
                </div>
              </div>
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
              <details className={styles.advanced}>
                <summary>{t('guideScope')}</summary>
                <p>{t('baselineHint')}</p>
              </details>
            </section>
          </fieldset>
          <div className={styles.saveBar}>
            <p className={styles.hint} role="status">
              {t(saved ? 'saved' : dirty ? 'settingsDirty' : 'settingsUnchanged')}
            </p>
            <button type="submit" disabled={status !== 'ready' || (!dirty && !changedConfig)}>
              {t(status === 'saving' ? 'saving' : saveLabel)}
            </button>
          </div>
        </form>
      )}
      {confirm && (
        <TaskConfirm
          title={t('saveWhileRunningTitle')}
          confirm={t('confirmSave')}
          cancel={t('continueEditing')}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            void save(true);
          }}
        >
          <p>{t('saveWhileRunningDescription')}</p>
        </TaskConfirm>
      )}
    </div>
  );
}
