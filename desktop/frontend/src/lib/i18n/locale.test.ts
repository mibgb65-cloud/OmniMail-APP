import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectLocale,
  isLocale,
  LOCALE_STORAGE_KEY,
  persistLocale,
  readInitialLocale,
} from './locale';
import type { Locale } from './resources';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('语言检测与偏好', () => {
  it.each([
    [['en-US'], 'en'],
    [['en-GB'], 'en'],
    [['en-US-u-ca-gregory'], 'en'],
    [['EN-us'], 'en'],
    [['zh-CN'], 'zh-CN'],
    [['zh-Hans-SG'], 'zh-CN'],
    [['fr-FR', 'en-GB', 'zh-CN'], 'en'],
    [['fr-FR'], 'zh-CN'],
    [[], 'zh-CN'],
    [[null, 1, 'en<script>', 'en-US\n', 'e'.repeat(65), 'zh-CN'], 'zh-CN'],
  ])('从系统语言 %j 选择 %s', (languages, expected) => {
    expect(detectLocale(languages)).toBe(expected);
  });

  it.each([null, undefined, '', 'fr', 'en-US', '<script>', {}, 1])(
    '拒绝不支持的偏好值 %j',
    (value) => {
      expect(isLocale(value)).toBe(false);
    },
  );

  it('手动偏好优先于系统语言', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    expect(persistLocale('zh-CN')).toBe(true);
    expect(readInitialLocale()).toBe('zh-CN');
  });

  it('拒绝运行时传入的非法语言，保留已有偏好', () => {
    persistLocale('en');
    // 故意绕过静态类型，模拟来自外部的非法语言代码。
    expect(persistLocale('fr' as Locale)).toBe(false);
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('忽略损坏偏好并跟随系统语言', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'invalid');
    expect(readInitialLocale()).toBe('en');
  });

  it('没有语言列表时使用系统的单个语言', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-AU');
    expect(readInitialLocale()).toBe('en');
  });

  it('存储访问被禁用时仍能读取系统语言并安全降级', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    expect(readInitialLocale()).toBe('en');
    expect(persistLocale('zh-CN')).toBe(false);
  });
});
