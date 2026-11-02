import { System } from '@wailsio/runtime';
import { InitialLocale } from '../../../bindings/omnimail/desktop/internal/bridge/installationbridge';
import { isLocale } from '../i18n/locale';
import type { Locale } from '../i18n/resources';

export async function readInstallationLocale(signal?: AbortSignal): Promise<Locale | null> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 3000);
  try {
    if (controller.signal.aborted || !System.IsDesktop()) return null;
    const value: unknown = await InitialLocale().cancelOn(controller.signal);
    return isLocale(value) ? value : null;
  } catch {
    // 未安装/浏览器预览/桥接不可用时保留系统语言，不向界面泄露本机注册表错误。
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
