import { useSyncExternalStore } from 'react';

export type ImagePolicy = 'none' | 'inline' | 'all';
export const IMAGE_POLICY_STORAGE_KEY = 'omnimail.mailImages';
const CHANGE_EVENT = 'omnimail:mail-images';
let sessionPolicy: ImagePolicy = 'inline';
let volatilePolicy: ImagePolicy | undefined;

function isPolicy(value: unknown): value is ImagePolicy {
  return value === 'none' || value === 'inline' || value === 'all';
}
function readPolicy(): ImagePolicy {
  if (volatilePolicy) return volatilePolicy;
  try {
    const value = localStorage.getItem(IMAGE_POLICY_STORAGE_KEY);
    return isPolicy(value) ? value : 'inline';
  } catch {
    return sessionPolicy;
  }
}
export function setImagePolicy(value: unknown): boolean {
  if (!isPolicy(value)) return false;
  sessionPolicy = value;
  try {
    localStorage.setItem(IMAGE_POLICY_STORAGE_KEY, value);
    volatilePolicy = undefined;
  } catch {
    // 存储受限时保留当前会话偏好，不扩大权限或导致设置界面不可用。
    volatilePolicy = value;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return volatilePolicy === undefined;
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === IMAGE_POLICY_STORAGE_KEY || event.key === null) notify();
  };
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener('storage', storage);
  };
}
export function useImagePolicy() {
  return useSyncExternalStore(subscribe, readPolicy, () => 'inline' as const);
}
