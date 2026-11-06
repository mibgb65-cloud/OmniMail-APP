import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { AccountSummary, MailSummary } from '../../lib/bridge/mail';
import type { TodoStatus } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { UiIcon, type UiIconName } from '../UiIcon/UiIcon';
import { TaskError } from './TaskError';
import { TaskSettings } from './TaskSettings';
import { TaskBatches } from './TaskBatches';
import { TodoEditor } from './TodoEditor';
import { TodoList } from './TodoList';
import { TaskConfirm } from './TaskConfirm';
import { useTaskWorkspace } from './useTaskWorkspace';
import styles from './Tasks.module.css';

const tabs = ['todos', 'sources', 'settings'] as const;
const icons: Record<(typeof tabs)[number], UiIconName> = {
  todos: 'list',
  sources: 'sparkles',
  settings: 'settings',
};

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
  const scrollPositions = useRef<Partial<Record<(typeof tabs)[number], number>>>({});
  const exit = useDialogExit(ref, onClose);
  const [tab, setTab] = useState<(typeof tabs)[number]>('todos');
  const [filter, setFilter] = useState<'all' | TodoStatus>('all');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<string>();
  const [settingsVisited, setSettingsVisited] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  const data = useTaskWorkspace(filter, offset, setOffset);
  const overview = data.overview;
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    node?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    return () => {
      if (node?.open) node.close();
    };
  }, []);
  const selectTab = (value: (typeof tabs)[number]) => {
    if (settingsSaving) return;
    const viewport = ref.current?.querySelector<HTMLElement>('[data-custom-scrollbar]');
    if (viewport) scrollPositions.current[tab] = viewport.scrollTop;
    setTab(value);
    if (value === 'settings') setSettingsVisited(true);
  };
  useLayoutEffect(() => {
    const viewport = ref.current?.querySelector<HTMLElement>('[data-custom-scrollbar]');
    if (viewport) viewport.scrollTop = scrollPositions.current[tab] ?? 0;
  }, [tab]);
  const close = () => {
    if (settingsSaving) return;
    if (settingsDirty) {
      setDiscard(true);
      return;
    }
    exit.close();
  };
  const status = overview?.state.running
    ? 'backgroundRunning'
    : overview?.state.error
      ? 'backgroundNeedsReview'
      : overview?.prefs.enabled
        ? 'dailyEnabled'
        : 'dailyDisabled';
  return (
    <>
      <DialogFrame
        ref={ref}
        className={styles.dialog}
        closing={exit.closing}
        aria-label={t('title')}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>{t('workspaceEyebrow')}</div>
            <h2 className={styles.dialogTitle} tabIndex={-1}>
              {t('title')}
            </h2>
            <p className={styles.hint}>{t('workspaceDescription')}</p>
          </div>
          <div className={styles.headerActions}>
            {settingsDirty && <span className={styles.unsavedBadge}>{t('unsavedShort')}</span>}
            <button
              type="button"
              data-button-variant="ghost"
              className={styles.iconButton}
              aria-label={t('refresh')}
              data-tooltip={t('refresh')}
              onClick={data.refresh}
            >
              <UiIcon name="sync" />
            </button>
            <button
              type="button"
              data-button-variant="ghost"
              className={styles.iconButton}
              aria-label={t('close')}
              data-tooltip={t('close')}
              disabled={settingsSaving}
              onClick={close}
            >
              <UiIcon name="close" />
            </button>
          </div>
        </header>
        <div className={styles.navigation}>
          <div className={styles.tabs} role="tablist" aria-label={t('title')}>
            {tabs.map((value) => (
              <button
                type="button"
                data-button-variant="ghost"
                role="tab"
                aria-label={t(value)}
                id={`${id}-tab-${value}`}
                aria-controls={`${id}-panel-${value}`}
                tabIndex={tab === value ? 0 : -1}
                aria-selected={tab === value}
                disabled={settingsSaving}
                key={value}
                onClick={() => selectTab(value)}
                onKeyDown={(event) => {
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
                  if (!next || settingsSaving) return;
                  event.preventDefault();
                  selectTab(next);
                  document.getElementById(`${id}-tab-${next}`)?.focus();
                }}
              >
                <UiIcon name={icons[value]} />
                {t(value)}
                {value === 'todos' && data.counts?.suggested ? (
                  <span className={styles.navCount}>{data.counts.suggested}</span>
                ) : null}
              </button>
            ))}
          </div>
          <span
            className={styles.backgroundStatus}
            data-running={overview?.state.running || undefined}
          >
            <span />
            {t(overview ? status : 'backgroundLoading')}
          </span>
        </div>
        <ScrollArea className={styles.contentArea} viewportClassName={styles.body}>
          <section
            role="tabpanel"
            id={`${id}-panel-todos`}
            aria-labelledby={`${id}-tab-todos`}
            hidden={tab !== 'todos'}
          >
            <TodoList
              page={data.page}
              counts={data.counts}
              error={data.listError}
              filter={filter}
              offset={offset}
              accounts={accounts}
              onFilter={(value) => {
                setFilter(value);
                setOffset(0);
              }}
              onOffset={setOffset}
              onEdit={setEditing}
              onSources={() => selectTab('sources')}
              onRefresh={data.refresh}
            />
          </section>
          <section
            role="tabpanel"
            id={`${id}-panel-sources`}
            aria-labelledby={`${id}-tab-sources`}
            hidden={tab !== 'sources'}
          >
            {data.overviewError != null && <TaskError error={data.overviewError} />}
            {!overview && !data.overviewError && <p role="status">{t('loading')}</p>}
            {overview && (
              <TaskBatches
                accounts={accounts}
                mails={mails}
                runs={overview.runs}
                prefs={overview.prefs}
                running={overview.state.running}
                onChanged={data.refresh}
                onSettings={() => selectTab('settings')}
              />
            )}
          </section>
          <section
            role="tabpanel"
            id={`${id}-panel-settings`}
            aria-labelledby={`${id}-tab-settings`}
            hidden={tab !== 'settings'}
          >
            {settingsVisited && (
              <TaskSettings
                accounts={accounts}
                onSaved={data.refresh}
                running={overview?.state.running}
                onDirtyChange={setSettingsDirty}
                onBusyChange={setSettingsSaving}
              />
            )}
          </section>
        </ScrollArea>
        <footer className={styles.workspaceFooter}>
          <details>
            <summary>
              <UiIcon name="about" size={15} />
              {t('privacyAndRetention')}
            </summary>
            <p>{t('retention')}</p>
          </details>
          <span>{t('localFirst')}</span>
        </footer>
      </DialogFrame>
      {editing !== undefined && (
        <TodoEditor
          id={editing}
          accounts={accounts}
          onClose={() => setEditing(undefined)}
          onSaved={data.refresh}
        />
      )}
      {discard && (
        <TaskConfirm
          title={t('leaveSettingsTitle')}
          confirm={t('discardSettings')}
          cancel={t('continueEditing')}
          danger
          onCancel={() => {
            setDiscard(false);
            selectTab('settings');
          }}
          onConfirm={() => {
            setDiscard(false);
            exit.close();
          }}
        >
          <p>{t('leaveSettingsDescription')}</p>
        </TaskConfirm>
      )}
    </>
  );
}
