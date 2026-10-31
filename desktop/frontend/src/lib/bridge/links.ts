import { Browser, System } from '@wailsio/runtime';
import { safeMailURL } from '../mail/mailDocument';

export async function openMailLink(value: string) {
  const url = safeMailURL(value);
  if (!url || !System.IsDesktop()) throw new Error('LINK_UNAVAILABLE');
  try {
    await Browser.OpenURL(url);
  } catch {
    throw new Error('LINK_UNAVAILABLE');
  }
}
