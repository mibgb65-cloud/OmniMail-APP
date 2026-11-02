import { System } from '@wailsio/runtime';
import {
  Create,
  List,
} from '../../../bindings/omnimail/desktop/internal/bridge/customprovidersbridge';
import type { CustomProviderInput } from '../../../bindings/omnimail/desktop/internal/service/models';
import type { ProviderPreset } from './mail';
import { AuthKind, TLSMode } from './mail';

export type { CustomProviderInput };
export const supportsCustomProviders = () => System.IsDesktop();
export const isSavedProviderCode = (code: string) => /^saved_[a-f0-9]{32}$/.test(code);
function isHost(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 253) return false;
  if (value.includes(':')) {
    if (!/^[a-f\d:.]+$/i.test(value)) return false;
    try {
      return new URL(`https://[${value}]/`).hostname.startsWith('[');
    } catch {
      return false;
    }
  }
  return value
    .replace(/\.$/, '')
    .split('.')
    .every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}
function isEndpoint(value: unknown) {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'protocol' in value &&
    (value.protocol === 'imap' || value.protocol === 'smtp') &&
    'host' in value &&
    isHost(value.host) &&
    'port' in value &&
    typeof value.port === 'number' &&
    Number.isInteger(value.port) &&
    value.port > 0 &&
    value.port <= 65535 &&
    'tlsMode' in value &&
    (value.tlsMode === TLSMode.TLSImplicit || value.tlsMode === TLSMode.TLSStartTLS)
  );
}
export function isSavedProvider(value: unknown): value is ProviderPreset {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'code' in value &&
    typeof value.code === 'string' &&
    isSavedProviderCode(value.code) &&
    'name' in value &&
    typeof value.name === 'string' &&
    new TextEncoder().encode(value.name).length <= 128 &&
    value.name.length > 0 &&
    value.name.trim() === value.name &&
    !Array.from(value.name).some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159);
    }) &&
    'authKinds' in value &&
    Array.isArray(value.authKinds) &&
    value.authKinds.length === 1 &&
    value.authKinds[0] === AuthKind.AuthPassword &&
    'endpoints' in value &&
    Array.isArray(value.endpoints) &&
    value.endpoints.length === 2 &&
    value.endpoints.every(isEndpoint) &&
    value.endpoints.some(
      (endpoint: unknown) =>
        typeof endpoint === 'object' &&
        endpoint !== null &&
        'protocol' in endpoint &&
        endpoint.protocol === 'imap',
    ) &&
    value.endpoints.some(
      (endpoint: unknown) =>
        typeof endpoint === 'object' &&
        endpoint !== null &&
        'protocol' in endpoint &&
        endpoint.protocol === 'smtp',
    )
  );
}
export function customProviderError(error: unknown) {
  const text = error instanceof Error ? error.message : '';
  if (text.includes('PROVIDER_NAME_EXISTS')) return 'customProviderNameExists';
  if (text.includes('PROVIDER_LIMIT')) return 'customProviderLimit';
  if (text.includes('INVALID_INPUT')) return 'customProviderInvalid';
  return 'customProviderSaveError';
}
async function call<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10_000);
  let failure: string;
  try {
    if (!supportsCustomProviders() || controller.signal.aborted) throw new Error('unavailable');
    return await operation(controller.signal);
  } catch (error) {
    // 只保留允许的业务错误码，不传播主机、路径或其他原始 IPC 诊断。
    const text = error instanceof Error ? error.message : '';
    const code = ['PROVIDER_NAME_EXISTS', 'PROVIDER_LIMIT', 'INVALID_INPUT'].find((value) =>
      text.includes(value),
    );
    failure = code ?? 'PROVIDER_STORAGE_FAILED';
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  throw new Error(failure);
}
export async function listCustomProviders(signal?: AbortSignal): Promise<ProviderPreset[]> {
  const value: unknown = await call((abort) => List().cancelOn(abort), signal);
  if (
    !Array.isArray(value) ||
    value.length > 32 ||
    !value.every(isSavedProvider) ||
    new Set(value.map((provider) => provider.code)).size !== value.length
  )
    throw new Error('PROVIDER_STORAGE_FAILED');
  return value;
}
export async function createCustomProvider(input: CustomProviderInput, signal?: AbortSignal) {
  const value: unknown = await call((abort) => Create(input).cancelOn(abort), signal);
  if (!isSavedProvider(value)) throw new Error('PROVIDER_STORAGE_FAILED');
  return value;
}
