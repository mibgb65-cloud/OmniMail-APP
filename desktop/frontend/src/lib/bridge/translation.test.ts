import { CancellablePromise } from '@wailsio/runtime/cancellable';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Preferences,
  SetPreferences,
  Translate,
  Cached,
} from '../../../bindings/omnimail/desktop/internal/bridge/translationbridge';
import {
  isTranslationResult,
  saveTranslationPreferences,
  translateMail,
  translationPreferences,
  cachedTranslation,
} from './translation';
vi.mock('@wailsio/runtime', () => ({ System: { IsDesktop: () => true } }));
vi.mock('../../../bindings/omnimail/desktop/internal/bridge/translationbridge', () => ({
  Preferences: vi.fn(),
  SetPreferences: vi.fn(),
  Translate: vi.fn(),
  Cached: vi.fn(),
}));
const value = {
  mailId: 'mail_test',
  sourceHash: 'a'.repeat(64),
  model: 'Index-Translate-35B-A3B',
  target: 'zh',
  cached: false,
  subject: '标题',
  body: '正文',
};
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
it('缓存读取是独立只读接口，未命中不生成翻译请求', async () => {
  vi.mocked(Cached).mockReturnValueOnce(new CancellablePromise((resolve) => resolve(null)));
  await expect(cachedTranslation('mail_test')).resolves.toBeNull();
  vi.mocked(Cached).mockReturnValueOnce(
    new CancellablePromise((resolve) => resolve({ ...value, cached: true })),
  );
  await expect(cachedTranslation('mail_test')).resolves.toEqual({ ...value, cached: true });
  expect(Translate).not.toHaveBeenCalled();
});
it.each([
  null,
  [],
  {},
  { ...value, sourceHash: 'path' },
  { ...value, target: 'unknown' },
  { ...value, body: 1 },
  { ...value, model: 'other' },
  { ...value, warning: 'private' },
])('拒绝不可信译文 %#', (input) => expect(isTranslationResult(input)).toBe(false));
it('桥接只传 ID 与目标，不把前端邮件头或凭据作为参数', async () => {
  vi.mocked(Preferences).mockReturnValue(
    new CancellablePromise((resolve) => resolve({ target: 'zh', consent: false })),
  );
  vi.mocked(SetPreferences).mockReturnValue(new CancellablePromise((resolve) => resolve()));
  vi.mocked(Translate).mockReturnValue(new CancellablePromise((resolve) => resolve(value)));
  await expect(translationPreferences()).resolves.toEqual({ target: 'zh', consent: false });
  await saveTranslationPreferences({ target: 'ja', consent: true });
  expect(SetPreferences).toHaveBeenCalledWith({ target: 'ja', consent: true });
  await expect(translateMail('mail_test', 'zh')).resolves.toEqual(value);
  expect(Translate).toHaveBeenCalledWith('mail_test', 'zh');
});
it('超时取消原生请求并清理计时器', async () => {
  vi.useFakeTimers();
  vi.mocked(Translate).mockReturnValue(new CancellablePromise(() => {}));
  const result = expect(translateMail('mail_test', 'zh')).rejects.toThrow('TRANSLATION_TIMEOUT');
  await vi.advanceTimersByTimeAsync(125_000);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});
