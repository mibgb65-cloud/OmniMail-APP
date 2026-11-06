import { CancellablePromise } from '@wailsio/runtime/cancellable';
import { afterEach, expect, it, vi } from 'vitest';
import * as native from '../../../bindings/omnimail/desktop/internal/bridge/tasksbridge';
import { editTodo, saveTaskPreferences, startTaskBatch } from './tasks';
import { isPreferences, isRunDetails, isTodo } from './taskModels';
import { prefs, todo } from '../../components/Tasks/fixtures';
vi.mock('@wailsio/runtime', () => ({ System: { IsDesktop: () => true } }));
vi.mock('../../../bindings/omnimail/desktop/internal/bridge/tasksbridge', () => ({
  Edit: vi.fn(),
  SetPreferences: vi.fn(),
  RunBatch: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
it('待办冲突保留安全错误码，不泄露底层文本', async () => {
  vi.mocked(native.Edit).mockReturnValue(
    new CancellablePromise((_resolve, reject) => reject(new Error('TASK_CONFLICT private-marker'))),
  );
  await expect(editTodo(todo)).rejects.toThrow(/^TASK_CONFLICT$/);
});
it('非法自动授权和空批次在调用原生前拒绝', async () => {
  await expect(saveTaskPreferences({ ...prefs, enabled: true, consent: false })).rejects.toThrow(
    'TASK_INVALID_INPUT',
  );
  await expect(startTaskBatch([], false)).rejects.toThrow('TASK_INVALID_INPUT');
  expect(native.SetPreferences).not.toHaveBeenCalled();
  expect(native.RunBatch).not.toHaveBeenCalled();
});
it('保存仅发送可写配置字段，不能由前端伪造配置修订', async () => {
  vi.mocked(native.SetPreferences).mockReturnValue(
    new CancellablePromise((resolve) => resolve(prefs)),
  );
  await saveTaskPreferences(prefs);
  expect(native.SetPreferences).toHaveBeenCalledWith({
    enabled: false,
    consent: true,
    accounts: prefs.accounts,
    folders: prefs.folders,
    time: prefs.time,
    timezone: prefs.timezone,
    limit: prefs.limit,
  });
});
it('拒绝不可信待办、配置和运行明细', () => {
  expect(isTodo({ ...todo, status: 'execute', version: 0 })).toBe(false);
  expect(isPreferences({ ...prefs, accounts: null })).toBe(false);
  expect(isRunDetails({ run: {}, mails: [] })).toBe(false);
});
