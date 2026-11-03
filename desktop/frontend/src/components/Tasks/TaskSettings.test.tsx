import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../../lib/bridge/tasks';
import { aiConfig } from '../../lib/bridge/ai';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { TaskSettings } from './TaskSettings';
import { account, prefs } from './fixtures';
vi.mock('../../lib/bridge/tasks', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/tasks')>()),
  taskPreferences: vi.fn(),
  saveTaskPreferences: vi.fn(),
  startTaskBatch: vi.fn(),
  runPendingTasks: vi.fn(),
}));
vi.mock('../../lib/bridge/ai', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/ai')>()),
  aiConfig: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api.taskPreferences).mockReset().mockResolvedValue(prefs);
  vi.mocked(aiConfig).mockReset().mockResolvedValue({
    endpoint: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    language: 'zh',
    consent: true,
    hasKey: true,
    revision: 'ai_1',
  });
  vi.mocked(api.saveTaskPreferences)
    .mockReset()
    .mockImplementation(async (input) => ({ ...input, revision: 'scope_2', aiRevision: 'ai_1' }));
  vi.mocked(api.startTaskBatch).mockReset();
  vi.mocked(api.runPendingTasks).mockReset();
});
async function setup() {
  render(
    <I18nProvider initialLocale="zh-CN">
      <TaskSettings accounts={[account]} onSaved={vi.fn()} />
    </I18nProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());
}
it('每日功能不自动开启或外发；变更范围取消授权及每日开关', async () => {
  await setup();
  expect(screen.getByRole('checkbox', { name: '启用每日自动分析' })).not.toBeChecked();
  expect(api.startTaskBatch).not.toHaveBeenCalled();
  expect(api.runPendingTasks).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: '归档' }));
  expect(screen.getByRole('checkbox', { name: /允许后台/ })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '启用每日自动分析' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /允许后台/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: '启用每日自动分析' }));
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await screen.findByText('设置已保存。');
  expect(api.saveTaskPreferences).toHaveBeenCalledWith(
    expect.objectContaining({ enabled: true, consent: true, folders: ['inbox', 'archive'] }),
    expect.any(AbortSignal),
  );
});
it('AI 配置变化不能沿用旧勾选授权', async () => {
  vi.mocked(aiConfig).mockResolvedValue({
    endpoint: 'https://other.invalid/v1',
    model: 'test',
    language: 'zh',
    consent: true,
    hasKey: true,
    revision: 'new_ai',
  });
  await setup();
  expect(screen.getByRole('checkbox', { name: /允许后台/ })).not.toBeChecked();
  expect(screen.getByText(/旧后台授权已失效/)).toBeVisible();
});
