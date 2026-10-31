import { System } from '@wailsio/runtime';
import * as native from '../../../bindings/omnimail/desktop/internal/bridge/appbridge';

// 邮件服务返回的是已解析的 addr-spec 列表，不猜测显示名或从任意文本中截取邮箱。
export function mailAddressesForCopy(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value))
    return;
  const addresses = value.split(',').map((address) => address.trim());
  if (!addresses.length || addresses.length > 100) return;
  const valid =
    /^[^\s<>(),;:"\\@]+@[a-zA-Z0-9\u0080-\uffff](?:[a-zA-Z0-9\u0080-\uffff.-]*[a-zA-Z0-9\u0080-\uffff])?$/u;
  if (
    addresses.some((address) => address.length > 320 || /\s/u.test(address) || !valid.test(address))
  )
    return;
  const result = addresses.join(', ');
  return result.length <= 4096 ? result : undefined;
}

export async function copyMailAddresses(value: unknown): Promise<void> {
  const text = mailAddressesForCopy(value);
  if (!text) throw new Error('COPY_UNAVAILABLE');
  try {
    if (System.IsDesktop()) await native.CopyMailAddresses(text);
    else {
      if (!navigator.clipboard?.writeText) throw new Error('COPY_UNAVAILABLE');
      await navigator.clipboard.writeText(text);
    }
  } catch {
    throw new Error('COPY_UNAVAILABLE');
  }
}
