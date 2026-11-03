import * as native from '../../../bindings/omnimail/desktop/internal/bridge/tasksbridge';
import { aiCall, aiErrorKey } from './ai';
import {
  isTodo,
  isDetails,
  isPreferences,
  isPreferencesInput,
  isSourceView,
  isRun,
  isRunDetails,
  record,
  type TodoEdit,
  type TaskPreferencesInput,
} from './taskModels';

const codes = [
  'TASK_INVALID_INPUT',
  'TASK_CONFLICT',
  'TASK_NOT_FOUND',
  'TASK_CONSENT_REQUIRED',
  'TASK_CONFIG_CHANGED',
  'TASK_BUSY',
  'TASK_OUTCOME_UNKNOWN',
  'TASK_STORAGE_FAILED',
  'TASK_LIMIT_REACHED',
  'TASK_SYNC_INCOMPLETE',
] as const;
export function isTaskErrorCode(value: string): value is (typeof codes)[number] {
  return codes.some((code) => code === value);
}
export function taskErrorKey(error: unknown) {
  const text = error instanceof Error ? error.message : '';
  return codes.find((code) => text.includes(code)) ?? aiErrorKey(error);
}
const call = <T>(fn: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) =>
  aiCall(fn, signal, 10_000, taskErrorKey);
function inputID(value: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error('TASK_INVALID_INPUT');
}
function invalid(): never {
  throw new Error('AI_INVALID_RESPONSE');
}
export async function listTodos(status: string, offset = 0, signal?: AbortSignal) {
  const v: unknown = await call((abort) => native.List(status, offset).cancelOn(abort), signal);
  if (!Array.isArray(v) || v.length > 100 || !v.every(isTodo)) return invalid();
  return v;
}
export async function todoDetail(id: string, signal?: AbortSignal) {
  inputID(id);
  const v: unknown = await call((abort) => native.Detail(id).cancelOn(abort), signal);
  if (!isDetails(v) || v.item.id !== id) return invalid();
  return v;
}
export async function editTodo(input: TodoEdit, signal?: AbortSignal) {
  if (
    !Number.isSafeInteger(input.version) ||
    input.version < 0 ||
    input.version > 1_000_000_000 ||
    (input.id !== '' && input.version < 1)
  )
    throw new Error('TASK_INVALID_INPUT');
  if (
    !isTodo({
      ...input,
      id: input.id || 'new_item',
      version: Math.max(1, input.version),
      createdAt: 0,
      updatedAt: 0,
    })
  )
    throw new Error('TASK_INVALID_INPUT');
  const payload: TodoEdit = {
    id: input.id,
    accountId: input.accountId,
    version: input.version,
    title: input.title,
    notes: input.notes,
    owner: input.owner,
    due: input.due,
    status: input.status,
  };
  const v: unknown = await call((abort) => native.Edit(payload).cancelOn(abort), signal);
  if (!isTodo(v) || (input.id && v.id !== input.id)) return invalid();
  return v;
}
export async function deleteTodo(id: string, version: number, signal?: AbortSignal) {
  inputID(id);
  await call((abort) => native.Delete(id, version).cancelOn(abort), signal);
}
export async function resolveTodo(
  id: string,
  version: number,
  accept: boolean,
  signal?: AbortSignal,
) {
  inputID(id);
  await call((abort) => native.Resolve(id, version, accept).cancelOn(abort), signal);
}
export async function taskSource(id: string, signal?: AbortSignal) {
  inputID(id);
  const v: unknown = await call((abort) => native.Source(id).cancelOn(abort), signal);
  if (!isSourceView(v) || v.source.id !== id) return invalid();
  return v;
}
export async function taskPreferences(signal?: AbortSignal) {
  const v: unknown = await call((abort) => native.Preferences().cancelOn(abort), signal);
  if (!isPreferences(v)) return invalid();
  return v;
}
export async function saveTaskPreferences(input: TaskPreferencesInput, signal?: AbortSignal) {
  if (!isPreferencesInput(input)) throw new Error('TASK_INVALID_INPUT');
  const payload: TaskPreferencesInput = {
    enabled: input.enabled,
    consent: input.consent,
    accounts: [...input.accounts],
    folders: [...input.folders],
    time: input.time,
    timezone: input.timezone,
    limit: input.limit,
  };
  const v: unknown = await call((abort) => native.SetPreferences(payload).cancelOn(abort), signal);
  if (!isPreferences(v)) return invalid();
  return v;
}
export async function startTaskBatch(ids: string[], retryUnknown: boolean, signal?: AbortSignal) {
  if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
    throw new Error('TASK_INVALID_INPUT');
  ids.forEach(inputID);
  const v: unknown = await call(
    (abort) => native.RunBatch({ mailIds: ids, retryUnknown }).cancelOn(abort),
    signal,
  );
  if (typeof v !== 'string') return invalid();
  inputID(v);
  return v;
}
export async function runPendingTasks(signal?: AbortSignal) {
  const v: unknown = await call((abort) => native.RunPending().cancelOn(abort), signal);
  if (typeof v !== 'string') return invalid();
  inputID(v);
  return v;
}
export async function taskRuns(signal?: AbortSignal) {
  const v: unknown = await call((abort) => native.Runs().cancelOn(abort), signal);
  if (!Array.isArray(v) || v.length > 20 || !v.every(isRun)) return invalid();
  return v;
}
export async function taskRunDetail(id: string, signal?: AbortSignal) {
  inputID(id);
  const v: unknown = await call((abort) => native.RunDetail(id).cancelOn(abort), signal);
  if (!isRunDetails(v) || v.run.id !== id) return invalid();
  return v;
}
export async function taskState(signal?: AbortSignal) {
  const v: unknown = await call((abort) => native.State().cancelOn(abort), signal);
  if (
    !record(v) ||
    typeof v.running !== 'boolean' ||
    typeof v.runId !== 'string' ||
    !/^[A-Za-z0-9_-]{0,64}$/.test(v.runId) ||
    typeof v.error !== 'string' ||
    !/^[A-Z0-9_]{0,80}$/.test(v.error)
  )
    return invalid();
  return { running: v.running, runId: v.runId, error: v.error };
}
export async function stopTasks(signal?: AbortSignal) {
  await call((abort) => native.Stop().cancelOn(abort), signal);
}
export async function resumeTasks(id: string, signal?: AbortSignal) {
  inputID(id);
  await call((abort) => native.Resume(id).cancelOn(abort), signal);
}
