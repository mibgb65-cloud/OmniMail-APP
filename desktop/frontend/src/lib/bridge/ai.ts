import { System } from '@wailsio/runtime';
import * as native from '../../../bindings/omnimail/desktop/internal/bridge/aibridge';
import type {
  AIConfig as NativeConfig,
  AIConfigInput as NativeInput,
} from '../../../bindings/omnimail/desktop/internal/domain/models';
import { isAIResult, type AIRequest } from './aiResult';
import { notifyCacheCleared } from './cacheInvalidation';
import type { AIProgress as NativeProgress } from '../../../bindings/omnimail/desktop/internal/service/models';
export type AIProgress = Omit<NativeProgress, 'stage'> & {
  stage: 'idle' | 'preparing' | 'generating' | 'savingResult';
};

export type AIConfig = NativeConfig;
export type AIConfigInput = NativeInput;
const listeners = new Set<() => void>();
let revision = 0;
export const aiRevision = () => revision;
export function subscribeAI(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function invalidateAI() {
  revision++;
  listeners.forEach((listener) => listener());
}
const codes = [
  'AI_INVALID_INPUT',
  'AI_NOT_CONFIGURED',
  'AI_CONSENT_REQUIRED',
  'AI_BUSY',
  'AI_UNAVAILABLE',
  'AI_INVALID_RESPONSE',
  'AI_RATE_LIMITED',
  'AI_STORAGE_FAILED',
  'AI_BODY_NOT_READY',
  'AI_TOO_LARGE',
  'AI_TIMEOUT',
  'AI_CANCELED',
] as const;
export function aiErrorKey(error: unknown) {
  const text = error instanceof Error ? error.message : '';
  if (/cancel/i.test(text)) return 'AI_CANCELED';
  if (/timeout|deadline/i.test(text)) return 'AI_TIMEOUT';
  return codes.find((code) => text.includes(code)) ?? 'AI_UNAVAILABLE';
}
export async function aiCall<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  timeout = 10_000,
  errorKey: (error: unknown) => string = aiErrorKey,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    abort();
  }, timeout);
  let failure: string;
  try {
    if (controller.signal.aborted) throw new Error('AI_CANCELED');
    if (!System.IsDesktop()) throw new Error('AI_UNAVAILABLE');
    return await operation(controller.signal);
  } catch (error) {
    failure = timedOut ? 'AI_TIMEOUT' : controller.signal.aborted ? 'AI_CANCELED' : errorKey(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  throw new Error(failure);
}
export function isAIConfig(value: unknown): value is AIConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'endpoint' in value &&
    typeof value.endpoint === 'string' &&
    value.endpoint.length <= 2048 &&
    'model' in value &&
    typeof value.model === 'string' &&
    value.model.length <= 128 &&
    'language' in value &&
    (value.language === 'zh' || value.language === 'en') &&
    'consent' in value &&
    typeof value.consent === 'boolean' &&
    'hasKey' in value &&
    typeof value.hasKey === 'boolean' &&
    'revision' in value &&
    typeof value.revision === 'string' &&
    (value.revision === '' || /^[A-Za-z0-9_-]{1,64}$/.test(value.revision)) &&
    !('apiKey' in value) &&
    !('credentialRef' in value)
  );
}
export async function aiConfig(signal?: AbortSignal) {
  const value: unknown = await aiCall((abort) => native.Config().cancelOn(abort), signal);
  if (!isAIConfig(value)) throw new Error('AI_INVALID_RESPONSE');
  return value;
}
export async function saveAIConfig(input: AIConfigInput, signal?: AbortSignal) {
  if (
    typeof input.endpoint !== 'string' ||
    input.endpoint.length > 2048 ||
    typeof input.model !== 'string' ||
    input.model.length > 128 ||
    (input.language !== 'zh' && input.language !== 'en') ||
    typeof input.consent !== 'boolean' ||
    typeof input.removeKey !== 'boolean' ||
    typeof input.apiKey !== 'string' ||
    input.apiKey.length > 2048
  )
    throw new Error('AI_INVALID_INPUT');
  try {
    const value: unknown = await aiCall(
      (abort) => native.SaveConfig(input).cancelOn(abort),
      signal,
    );
    if (!isAIConfig(value)) throw new Error('AI_INVALID_RESPONSE');
    return value;
  } finally {
    // 写盘完成但凭据清理失败/IPC 取消时后端仍可能已改变，旧快照必须失效。
    invalidateAI();
  }
}
export async function testAIConnection(signal?: AbortSignal) {
  await aiCall((abort) => native.TestConnection().cancelOn(abort), signal, 125_000);
}
export async function runMailAI(input: AIRequest, signal?: AbortSignal) {
  if (
    !/^[A-Za-z0-9_-]{1,64}$/.test(input.mailId) ||
    (input.action !== 'analysis' && input.action !== 'reply') ||
    new TextEncoder().encode(input.intent).length > 2000
  )
    throw new Error('AI_INVALID_INPUT');
  const value: unknown = await aiCall(
    (abort) => native.Run(input).cancelOn(abort),
    signal,
    125_000,
  );
  if (!isAIResult(value) || value.mailId !== input.mailId || value.action !== input.action)
    throw new Error('AI_INVALID_RESPONSE');
  return value;
}
export async function cachedMailAI(id: string, signal?: AbortSignal) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('AI_INVALID_INPUT');
  const value: unknown = await aiCall((abort) => native.Cached(id).cancelOn(abort), signal);
  if (value === null) return null;
  if (!isAIResult(value) || value.mailId !== id || value.action !== 'analysis' || !value.cached)
    throw new Error('AI_INVALID_RESPONSE');
  return value;
}
export async function aiProgress(id: string, signal?: AbortSignal): Promise<AIProgress> {
  const value: unknown = await aiCall((abort) => native.Progress(id).cancelOn(abort), signal);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('stage' in value) ||
    (value.stage !== 'idle' &&
      value.stage !== 'preparing' &&
      value.stage !== 'generating' &&
      value.stage !== 'savingResult') ||
    !('retrySeconds' in value) ||
    typeof value.retrySeconds !== 'number' ||
    !Number.isInteger(value.retrySeconds) ||
    value.retrySeconds < 0 ||
    value.retrySeconds > 300
  )
    throw new Error('AI_INVALID_RESPONSE');
  return { stage: value.stage, retrySeconds: value.retrySeconds };
}
export async function clearAICaches(signal?: AbortSignal) {
  try {
    await aiCall((abort) => native.ClearCache().cancelOn(abort), signal);
  } finally {
    // 任一分类清理失败也可能已删掉另一类；让所有视图重新只读核对，不能保留失实缓存。
    invalidateAI();
    notifyCacheCleared();
  }
}
