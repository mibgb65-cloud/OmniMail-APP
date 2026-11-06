import { Usage } from '../../../bindings/omnimail/desktop/internal/bridge/storagebridge';
import type { StorageUsage } from '../../../bindings/omnimail/desktop/internal/service/models';

export type { StorageUsage };

const fields = [
  'mailDataBytes',
  'attachmentsBytes',
  'logsBytes',
  'backupsBytes',
  'otherBytes',
] as const;

export function isStorageUsage(value: unknown): value is StorageUsage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (
    !('totalBytes' in value) ||
    typeof value.totalBytes !== 'number' ||
    !Number.isSafeInteger(value.totalBytes) ||
    value.totalBytes < 0
  )
    return false;
  let sum = 0;
  for (const key of fields) {
    if (!(key in value)) return false;
    const bytes: unknown = Reflect.get(value, key);
    if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) return false;
    sum += bytes;
    if (!Number.isSafeInteger(sum)) return false;
  }
  return sum === value.totalBytes;
}

export async function getStorageUsage(signal?: AbortSignal): Promise<StorageUsage> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 12_000);
  try {
    const value: unknown = await Usage().cancelOn(controller.signal);
    if (!isStorageUsage(value)) throw new Error('存储统计格式无效');
    return value;
  } catch {
    // 不传播 IPC 原始错误，避免把本机路径或底层诊断带到界面。
    throw new Error('无法读取本机存储情况，请在桌面应用中重试。');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
