import { CancellablePromise } from '@wailsio/runtime/cancellable';
import { afterEach, expect, it, vi } from 'vitest';
import * as native from '../../../bindings/omnimail/desktop/internal/bridge/aibridge';
import { aiConfig, runMailAI, cachedMailAI, saveAIConfig } from './ai';
import { isAIResult } from './aiResult';

vi.mock('@wailsio/runtime', () => ({ System: { IsDesktop: () => true } }));
vi.mock('../../../bindings/omnimail/desktop/internal/bridge/aibridge', () => ({
  Config: vi.fn(),
  SaveConfig: vi.fn(),
  Run: vi.fn(),
  Cached: vi.fn(),
  Progress: vi.fn(),
  TestConnection: vi.fn(),
  ClearCache: vi.fn(),
}));
const config = {
  endpoint: 'https://example.invalid/v1',
  model: 'test',
  language: 'zh',
  consent: false,
  hasKey: true,
  revision: 'rev_1',
};
const result = {
  summary: 'summary',
  points: [],
  tasks: [],
  facts: [],
  reply: '',
  mailId: 'mail_test',
  accountId: 'account_test',
  sourceHash: 'a'.repeat(64),
  revision: 'rev_1',
  action: 'analysis',
  language: 'zh',
  model: 'test',
  cached: false,
  warning: '',
};
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
it('配置读取拒绝回显密钥，输入超限不调用原生服务', async () => {
  const leaked = { ...config, apiKey: 'must-not-leak' };
  vi.mocked(native.Config).mockReturnValue(new CancellablePromise((resolve) => resolve(leaked)));
  await expect(aiConfig()).rejects.toThrow('AI_INVALID_RESPONSE');
  await expect(
    saveAIConfig({ ...config, apiKey: 'x'.repeat(2049), removeKey: false }),
  ).rejects.toThrow('AI_INVALID_INPUT');
  expect(native.SaveConfig).not.toHaveBeenCalled();
});
it('缓存只读且未命中不会触发 Run；拒绝不匹配结果', async () => {
  vi.mocked(native.Cached).mockReturnValue(new CancellablePromise((resolve) => resolve(null)));
  await expect(cachedMailAI('mail_test')).resolves.toBeNull();
  expect(native.Run).not.toHaveBeenCalled();
  vi.mocked(native.Run).mockReturnValue(
    new CancellablePromise((resolve) => resolve({ ...result, mailId: 'other' })),
  );
  await expect(
    runMailAI({ mailId: 'mail_test', action: 'analysis', intent: '', tone: '', regenerate: false }),
  ).rejects.toThrow('AI_INVALID_RESPONSE');
});
it('AI 超时取消原生调用并释放定时器', async () => {
  vi.useFakeTimers();
  vi.mocked(native.Run).mockReturnValue(new CancellablePromise(() => {}));
  const pending = expect(
    runMailAI({ mailId: 'mail_test', action: 'analysis', intent: '', tone: '', regenerate: false }),
  ).rejects.toThrow('AI_TIMEOUT');
  await vi.advanceTimersByTimeAsync(125_000);
  await pending;
  expect(vi.getTimerCount()).toBe(0);
});
it.each([
  null,
  {},
  { ...result, points: null },
  { ...result, sourceHash: 'bad' },
  { ...result, warning: 'private' },
  { ...result, tasks: [{ text: 'x', evidence: 4, owner: '', due: '' }] },
])('拒绝不可信 AI 结果 %#', (value) => {
  expect(isAIResult(value)).toBe(false);
});
