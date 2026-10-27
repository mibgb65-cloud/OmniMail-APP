import { Version } from '../../../bindings/omnimail/desktop/internal/bridge/appbridge';
import type { VersionInfo } from '../../../bindings/omnimail/desktop/internal/bridge/models';

export type { VersionInfo };

function isText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  );
}

export function isVersionInfo(value: unknown): value is VersionInfo {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'version' in value &&
    isText(value.version, 64) &&
    /^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.+-]+)?$/.test(value.version) &&
    'commit' in value &&
    isText(value.commit, 64) &&
    /^(?:unknown|[a-f0-9]{7,64})$/.test(value.commit) &&
    'buildTime' in value &&
    isText(value.buildTime, 64) &&
    (value.buildTime === 'unknown' ||
      (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value.buildTime) &&
        Number.isFinite(Date.parse(value.buildTime)))) &&
    'goVersion' in value &&
    isText(value.goVersion, 64) &&
    /^go\d+\.\d+(?:\.\d+)?(?:[a-zA-Z0-9.-]+)?$/.test(value.goVersion) &&
    'platform' in value &&
    isText(value.platform, 32) &&
    /^[a-z0-9]+\/[a-z0-9]+$/.test(value.platform)
  );
}

export async function getVersion(signal?: AbortSignal): Promise<VersionInfo> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 10_000);
  try {
    const value: unknown = await Version().cancelOn(controller.signal);
    if (!isVersionInfo(value)) throw new Error('版本信息格式无效');
    return value;
  } catch {
    // 原始 IPC 错误可能包含诊断信息，不直接展示到用户界面。
    throw new Error('无法读取桌面服务信息，请在桌面应用中重试。');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
