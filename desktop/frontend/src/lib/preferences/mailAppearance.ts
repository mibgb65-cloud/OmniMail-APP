import { useSyncExternalStore } from 'react';

export const MAIL_DARK_MODE_STORAGE_KEY = 'omnimail.mailFollowsDarkMode';
const CHANGE_EVENT = 'omnimail:mail-appearance';
let sessionPreference = true;
let volatilePreference: boolean | undefined;

function readPreference(): boolean {
  if (volatilePreference !== undefined) return volatilePreference;
  try {
    return localStorage.getItem(MAIL_DARK_MODE_STORAGE_KEY) !== 'false';
  } catch {
    return sessionPreference;
  }
}

export function setMailFollowsDarkMode(value: unknown): boolean {
  if (typeof value !== 'boolean') return false;
  sessionPreference = value;
  try {
    localStorage.setItem(MAIL_DARK_MODE_STORAGE_KEY, String(value));
    volatilePreference = undefined;
  } catch {
    // 本地存储受限时只保留会话偏好，界面必须明确提示未持久化，不泄露底层诊断。
    volatilePreference = value;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return volatilePreference === undefined;
}

function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === MAIL_DARK_MODE_STORAGE_KEY || event.key === null) notify();
  };
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener('storage', storage);
  };
}

export function useMailFollowsDarkMode() {
  return useSyncExternalStore(subscribe, readPreference, () => true);
}
