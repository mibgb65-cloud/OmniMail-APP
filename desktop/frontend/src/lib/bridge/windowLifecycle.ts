import { Events } from '@wailsio/runtime';
import {
  State,
  SetMode,
  Resolve,
  Cancel,
} from '../../../bindings/omnimail/desktop/internal/bridge/windowlifecyclebridge';
import { supportsWindowControls } from './window';

export type CloseMode = 'ask' | 'quit' | 'background';
export interface WindowCloseState {
  mode: CloseMode;
  pending: boolean;
  backgroundAvailable: boolean;
}

export function isCloseMode(value: unknown): value is CloseMode {
  return value === 'ask' || value === 'quit' || value === 'background';
}
export function isWindowCloseState(value: unknown): value is WindowCloseState {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'mode' in value &&
    isCloseMode(value.mode) &&
    'pending' in value &&
    typeof value.pending === 'boolean' &&
    'backgroundAvailable' in value &&
    typeof value.backgroundAvailable === 'boolean'
  );
}

async function call<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 8_000);
  try {
    if (!supportsWindowControls() || controller.signal.aborted) throw new Error('桌面服务不可用');
    return await operation(controller.signal);
  } catch {
    throw new Error('无法完成关闭设置操作，请重试。');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function getWindowCloseState(signal?: AbortSignal): Promise<WindowCloseState> {
  const value: unknown = await call((abort) => State().cancelOn(abort), signal);
  if (!isWindowCloseState(value)) throw new Error('关闭设置数据无效，请重试。');
  return value;
}
export async function setCloseMode(mode: CloseMode) {
  if (!isCloseMode(mode)) throw new Error('关闭行为无效');
  await call((signal) => SetMode(mode).cancelOn(signal));
}
export async function resolveWindowClose(mode: Exclude<CloseMode, 'ask'>, remember: boolean) {
  if ((mode !== 'quit' && mode !== 'background') || typeof remember !== 'boolean')
    throw new Error('关闭选择无效');
  await call((signal) => Resolve(mode, remember).cancelOn(signal));
}
export async function cancelWindowClose() {
  await call((signal) => Cancel().cancelOn(signal));
}
export function subscribeWindowClose(onChange: () => void): () => void {
  if (!supportsWindowControls()) return () => {};
  return Events.On('omnimail:window-close-changed', (event) => {
    if (event.sender === 'main') onChange();
  });
}
