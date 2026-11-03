import type * as Native from '../../../bindings/omnimail/desktop/internal/domain/models';

export const todoStatuses = ['suggested', 'open', 'waiting', 'done', 'dismissed'] as const;
export const runStates = [
  'running',
  'success',
  'partial',
  'failed',
  'cancelled',
  'interrupted',
] as const;
export const mailStates = ['queued', 'processing', 'done', 'failed', 'unknown', 'skipped'] as const;
export const taskFolders = ['inbox', 'archive', 'sent', 'other'] as const;
export type TodoStatus = (typeof todoStatuses)[number];
export type Todo = Omit<Native.Todo, 'status'> & { status: TodoStatus };
export type TodoEdit = Native.TodoEdit;
export type TaskPreferencesInput = Omit<Native.TaskPreferencesInput, 'accounts' | 'folders'> & {
  accounts: string[];
  folders: string[];
};
export type TaskPreferences = Omit<Native.TaskPreferences, 'accounts' | 'folders'> &
  TaskPreferencesInput;
export type TodoSource = Native.TodoSource;
export type Proposal = Omit<Native.TodoProposal, 'kind' | 'state'> & {
  kind: 'update' | 'conflict' | 'cancel' | 'complete';
  state: 'open' | 'accepted' | 'dismissed';
};
export type TodoDetails = Omit<Native.TodoDetails, 'item' | 'sources' | 'proposals'> & {
  item: Todo;
  sources: TodoSource[];
  proposals: Proposal[];
};
export type Run = Omit<Native.TaskRun, 'kind' | 'state'> & {
  kind: 'manual' | 'daily';
  state: (typeof runStates)[number];
};
export type RunMail = Omit<Native.TaskRunMail, 'state'> & { state: (typeof mailStates)[number] };
export type RunDetails = Omit<Native.TaskRunDetails, 'run' | 'mails'> & {
  run: Run;
  mails: RunMail[];
};
export type SourceView = Native.TodoSourceView;

export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (v: unknown, max: number): v is string =>
  typeof v === 'string' && new TextEncoder().encode(v).length <= max;
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const code = (v: unknown) =>
  v === '' || (typeof v === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(v));
const includes = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && list.some((item) => item === v);
const ids = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= 20 && v.every(id) && new Set(v).size === v.length;

export function isTodo(v: unknown): v is Todo {
  return (
    record(v) &&
    id(v.id) &&
    (v.accountId === '' || id(v.accountId)) &&
    text(v.title, 1000) &&
    !!v.title.trim() &&
    text(v.notes, 4096) &&
    text(v.owner, 200) &&
    text(v.due, 100) &&
    includes(todoStatuses, v.status) &&
    integer(v.version, 1_000_000_000) &&
    v.version >= 1 &&
    integer(v.createdAt) &&
    integer(v.updatedAt)
  );
}
export function isPreferencesInput(v: unknown): v is TaskPreferencesInput {
  return (
    record(v) &&
    typeof v.enabled === 'boolean' &&
    typeof v.consent === 'boolean' &&
    (!v.enabled || v.consent) &&
    ids(v.accounts) &&
    (!v.consent || v.accounts.length > 0) &&
    Array.isArray(v.folders) &&
    v.folders.length >= 1 &&
    v.folders.length <= 4 &&
    new Set(v.folders).size === v.folders.length &&
    v.folders.every((f: unknown) => includes(taskFolders, f)) &&
    text(v.time, 5) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time) &&
    text(v.timezone, 64) &&
    !!v.timezone &&
    integer(v.limit, 100) &&
    v.limit >= 1
  );
}
export function isPreferences(v: unknown): v is TaskPreferences {
  if (!record(v)) return false;
  const revision = v.revision,
    aiRevision = v.aiRevision;
  return (
    isPreferencesInput(v) &&
    (revision === '' || id(revision)) &&
    (aiRevision === '' || id(aiRevision))
  );
}
export function isSource(v: unknown): v is TodoSource {
  return (
    record(v) &&
    id(v.id) &&
    id(v.todoId) &&
    id(v.mailId) &&
    id(v.accountId) &&
    text(v.subject, 4096) &&
    text(v.evidence, 2000) &&
    integer(v.receivedAt) &&
    typeof v.available === 'boolean'
  );
}
export function isProposal(v: unknown): v is Proposal {
  return (
    record(v) &&
    id(v.id) &&
    id(v.todoId) &&
    id(v.sourceId) &&
    includes(['update', 'conflict', 'cancel', 'complete'], v.kind) &&
    text(v.title, 1000) &&
    text(v.owner, 200) &&
    text(v.due, 100) &&
    text(v.reason, 1000) &&
    text(v.evidence, 2000) &&
    includes(['open', 'accepted', 'dismissed'], v.state) &&
    integer(v.createdAt)
  );
}
export function isDetails(v: unknown): v is TodoDetails {
  return (
    record(v) &&
    isTodo(v.item) &&
    Array.isArray(v.sources) &&
    v.sources.length <= 50 &&
    v.sources.every(isSource) &&
    Array.isArray(v.proposals) &&
    v.proposals.length <= 50 &&
    v.proposals.every(isProposal) &&
    typeof v.truncated === 'boolean'
  );
}
export function isRun(v: unknown): v is Run {
  return (
    record(v) &&
    id(v.id) &&
    includes(['manual', 'daily'], v.kind) &&
    includes(runStates, v.state) &&
    text(v.slot, 128) &&
    id(v.prefsRevision) &&
    integer(v.startedAt) &&
    integer(v.finishedAt) &&
    [
      'total',
      'done',
      'failed',
      'unknown',
      'pending',
      'waitingBody',
      'remaining',
      'newTodos',
      'changes',
    ].every((k) => integer(v[k], 1_000_000_000)) &&
    code(v.error) &&
    typeof v.retryUnknown === 'boolean' &&
    typeof v.syncPending === 'boolean'
  );
}
export function isRunDetails(v: unknown): v is RunDetails {
  return (
    record(v) &&
    isRun(v.run) &&
    Array.isArray(v.mails) &&
    v.mails.length <= 100 &&
    v.mails.every(
      (m: unknown) =>
        record(m) &&
        id(m.mailId) &&
        text(m.subject, 4096) &&
        includes(mailStates, m.state) &&
        code(m.error),
    )
  );
}
export function isSourceView(v: unknown): v is SourceView {
  return (
    record(v) &&
    isSource(v.source) &&
    text(v.body, 32 * 1024) &&
    typeof v.changed === 'boolean' &&
    code(v.error)
  );
}
