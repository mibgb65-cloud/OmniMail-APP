import * as native from '../../../bindings/omnimail/desktop/internal/bridge/mailbridge';
import type { CancellablePromise } from '@wailsio/runtime';
import { System } from '@wailsio/runtime';
import type {
  AccountSummary,
  AddAccountInput,
  SendInput,
} from '../../../bindings/omnimail/desktop/internal/service/models';
import type {
  MailDetail,
  MailSummary,
  ProviderPreset,
} from '../../../bindings/omnimail/desktop/internal/domain/models';

export type { AccountSummary, AddAccountInput, SendInput, MailDetail, MailSummary, ProviderPreset };
export { AuthKind, TLSMode } from '../../../bindings/omnimail/desktop/internal/domain/models';

export const errorKeys = {
  BRIDGE_UNAVAILABLE: 'error_BRIDGE_UNAVAILABLE',
  AUTH_INVALID: 'error_AUTH_INVALID',
  TLS_REQUIRED: 'error_TLS_REQUIRED',
  NETWORK_FAILED: 'error_NETWORK_FAILED',
  MAIL_PROTOCOL_FAILED: 'error_MAIL_PROTOCOL_FAILED',
  MESSAGE_TOO_LARGE: 'error_MESSAGE_TOO_LARGE',
  OAUTH_NOT_CONFIGURED: 'error_OAUTH_NOT_CONFIGURED',
  CREDENTIAL_MISSING: 'error_CREDENTIAL_MISSING',
  CREDENTIAL_UNAVAILABLE: 'error_CREDENTIAL_UNAVAILABLE',
  INVALID_CREDENTIAL: 'error_INVALID_CREDENTIAL',
  INVALID_INPUT: 'error_INVALID_INPUT',
  STORAGE_FAILED: 'error_STORAGE_FAILED',
  BUSY: 'error_BUSY',
  TIMEOUT: 'error_TIMEOUT',
  CANCELED: 'error_CANCELED',
  SEND_UNCERTAIN: 'error_SEND_UNCERTAIN',
  CREDENTIAL_CLEANUP_FAILED: 'error_CREDENTIAL_CLEANUP_FAILED',
  SAVE_FAILED: 'error_SAVE_FAILED',
} as const;

export function errorCode(error: unknown): keyof typeof errorKeys {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  for (const code of Object.keys(errorKeys) as Array<keyof typeof errorKeys>) {
    if (text.includes(code)) return code;
  }
  return 'BRIDGE_UNAVAILABLE';
}
export function errorKey(error: unknown) {
  return errorKeys[errorCode(error)];
}

async function call<T>(operation: () => CancellablePromise<T>, signal?: AbortSignal): Promise<T> {
  // 浏览器预览不创建原生调用；否则 StrictMode 取消后，运行时的延迟网络拒绝会成为未处理异常。
  if (!System.IsDesktop()) throw new Error('BRIDGE_UNAVAILABLE');
  if (signal?.aborted) throw new Error('CANCELED');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 65_000);
  try {
    return await operation().cancelOn(controller.signal);
  } catch (error) {
    throw new Error(controller.signal.aborted ? 'CANCELED' : errorCode(error), { cause: error });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function accounts(signal?: AbortSignal) {
  return (await call(native.Accounts, signal)) ?? [];
}
export async function providers(signal?: AbortSignal) {
  return (await call(native.Providers, signal)) ?? [];
}
export async function messages(
  account: string,
  folder: string,
  offset: number,
  signal?: AbortSignal,
) {
  return (await call(() => native.Messages(account, folder, offset), signal)) ?? [];
}
export function addAccount(input: AddAccountInput, signal?: AbortSignal) {
  return call(() => native.AddAccount(input), signal);
}
export function message(id: string, signal?: AbortSignal) {
  return call(() => native.Message(id), signal);
}
export function refreshMessage(id: string, signal?: AbortSignal) {
  return call(() => native.RefreshMessage(id), signal);
}
export function setStarred(id: string, starred: boolean) {
  return call(() => native.SetStarred(id, starred));
}
export function synchronize(id: string) {
  return call(() => native.Sync(id));
}
export function send(input: SendInput, signal?: AbortSignal) {
  return call(() => native.Send(input), signal);
}
export function disconnect(id: string) {
  return call(() => native.Disconnect(id));
}
export function saveAttachment(id: string) {
  return call(() => native.SaveAttachment(id));
}
