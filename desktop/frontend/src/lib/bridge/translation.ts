import { System } from '@wailsio/runtime';
import {
  Preferences,
  SetPreferences,
  Translate,
  Cached,
  Progress,
} from '../../../bindings/omnimail/desktop/internal/bridge/translationbridge';
import type {
  TranslationPreferences as NativePreferences,
  TranslationResult as NativeResult,
} from '../../../bindings/omnimail/desktop/internal/domain/models';
import type { TranslationProgress } from '../../../bindings/omnimail/desktop/internal/service/models';
export const translationLanguages = ['zh', 'en', 'ja', 'ko', 'de', 'fr', 'es'] as const;
export type TranslationLanguage = (typeof translationLanguages)[number];
export type TranslationPreferences = Omit<NativePreferences, 'target'> & {
  target: TranslationLanguage;
};
export type TranslationResult = Omit<NativeResult, 'target'> & { target: TranslationLanguage };
export function isTranslationLanguage(value: unknown): value is TranslationLanguage {
  return typeof value === 'string' && translationLanguages.some((language) => language === value);
}
export function isTranslationPreferences(value: unknown): value is TranslationPreferences {
  return (
    typeof value === 'object' &&
    value !== null &&
    'target' in value &&
    isTranslationLanguage(value.target) &&
    'consent' in value &&
    typeof value.consent === 'boolean'
  );
}
export function isTranslationResult(value: unknown): value is TranslationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'mailId' in value &&
    typeof value.mailId === 'string' &&
    /^[A-Za-z0-9_-]{1,64}$/.test(value.mailId) &&
    'sourceHash' in value &&
    typeof value.sourceHash === 'string' &&
    /^[a-f0-9]{64}$/.test(value.sourceHash) &&
    'model' in value &&
    value.model === 'Index-Translate-35B-A3B' &&
    'target' in value &&
    isTranslationLanguage(value.target) &&
    'cached' in value &&
    typeof value.cached === 'boolean' &&
    'subject' in value &&
    typeof value.subject === 'string' &&
    new TextEncoder().encode(value.subject).length <= 16 * 1024 &&
    'body' in value &&
    typeof value.body === 'string' &&
    new TextEncoder().encode(value.body).length <= 128 * 1024 &&
    (!('warning' in value) ||
      value.warning === undefined ||
      value.warning === '' ||
      value.warning === 'CACHE_NOT_SAVED' ||
      value.warning === 'CACHE_REBUILT')
  );
}
const codes = [
  'TRANSLATION_INVALID_INPUT',
  'TRANSLATION_CONSENT_REQUIRED',
  'TRANSLATION_BUSY',
  'TRANSLATION_RATE_LIMITED',
  'TRANSLATION_INVALID_RESPONSE',
  'TRANSLATION_TRUNCATED',
  'TRANSLATION_STORAGE_FAILED',
  'TRANSLATION_BODY_NOT_READY',
  'TRANSLATION_TOO_LARGE',
] as const;
export function translationErrorKey(error: unknown) {
  const text = error instanceof Error ? error.message : '';
  if (text.toLowerCase().includes('cancel')) return 'translationCanceled';
  if (text.toLowerCase().includes('timeout') || text.toLowerCase().includes('deadline'))
    return 'translationTimeout';
  const code = codes.find((value) => text.includes(value));
  return code ?? 'TRANSLATION_UNAVAILABLE';
}
async function call<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  timeout = 10_000,
) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    abort();
  }, timeout);
  let failure: string;
  try {
    if (!System.IsDesktop() || controller.signal.aborted) throw new Error('unavailable');
    return await operation(controller.signal);
  } catch (error) {
    failure = timedOut
      ? 'TRANSLATION_TIMEOUT'
      : controller.signal.aborted
        ? 'TRANSLATION_CANCELED'
        : translationErrorKey(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  throw new Error(failure);
}
export async function translationPreferences(signal?: AbortSignal) {
  const value: unknown = await call((abort) => Preferences().cancelOn(abort), signal);
  if (!isTranslationPreferences(value)) throw new Error('TRANSLATION_INVALID_RESPONSE');
  return value;
}
export async function saveTranslationPreferences(
  value: TranslationPreferences,
  signal?: AbortSignal,
) {
  if (!isTranslationPreferences(value)) throw new Error('TRANSLATION_INVALID_INPUT');
  await call((abort) => SetPreferences(value).cancelOn(abort), signal);
}
export async function translateMail(id: string, target: TranslationLanguage, signal?: AbortSignal) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !isTranslationLanguage(target))
    throw new Error('TRANSLATION_INVALID_INPUT');
  const value: unknown = await call(
    (abort) => Translate(id, target).cancelOn(abort),
    signal,
    125_000,
  );
  if (!isTranslationResult(value) || value.mailId !== id || value.target !== target)
    throw new Error('TRANSLATION_INVALID_RESPONSE');
  return value;
}
export async function cachedTranslation(
  id: string,
  signal?: AbortSignal,
): Promise<TranslationResult | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('TRANSLATION_INVALID_INPUT');
  const value: unknown = await call((abort) => Cached(id).cancelOn(abort), signal);
  if (value === null) return null;
  if (!isTranslationResult(value) || value.mailId !== id || !value.cached)
    throw new Error('TRANSLATION_INVALID_RESPONSE');
  return value;
}
export async function translationProgress(
  id: string,
  signal?: AbortSignal,
): Promise<TranslationProgress> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('TRANSLATION_INVALID_INPUT');
  const value: unknown = await call((abort) => Progress(id).cancelOn(abort), signal);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('stage' in value) ||
    (value.stage !== 'idle' &&
      value.stage !== 'preparing' &&
      value.stage !== 'generating' &&
      value.stage !== 'savingResult') ||
    !('current' in value) ||
    typeof value.current !== 'number' ||
    !Number.isInteger(value.current) ||
    value.current < 0 ||
    value.current > 16 ||
    !('total' in value) ||
    typeof value.total !== 'number' ||
    !Number.isInteger(value.total) ||
    value.total < value.current ||
    value.total > 16 ||
    !('retrySeconds' in value) ||
    typeof value.retrySeconds !== 'number' ||
    !Number.isInteger(value.retrySeconds) ||
    value.retrySeconds < 0 ||
    value.retrySeconds > 300
  )
    throw new Error('TRANSLATION_INVALID_RESPONSE');
  return {
    stage: value.stage,
    current: value.current,
    total: value.total,
    retrySeconds: value.retrySeconds,
  };
}
