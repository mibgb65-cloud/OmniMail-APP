import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../../lib/bridge/tasks';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { TasksDialog } from './TasksDialog';
import { account, mail, prefs } from './fixtures';
vi.mock('../../lib/bridge/tasks', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/tasks')>()),
  listTodos: vi.fn(),
  taskRuns: vi.fn(),
  taskPreferences: vi.fn(),
  taskState: vi.fn(),
  startTaskBatch: vi.fn(),
  runPendingTasks: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api.listTodos).mockResolvedValue([]);
  vi.mocked(api.taskRuns).mockResolvedValue([]);
  vi.mocked(api.taskPreferences).mockResolvedValue(prefs);
  vi.mocked(api.taskState).mockResolvedValue({ running: false, runId: '', error: '' });
  vi.mocked(api.startTaskBatch).mockReset();
  vi.mocked(api.runPendingTasks).mockReset();
});
it('打开管理只读本地数据，分类键盘切换不触发分析', async () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <TasksDialog accounts={[account]} mails={[mail]} onClose={vi.fn()} />
    </I18nProvider>,
  );
  await screen.findByText('暂无事项。可手动新增，或授权后分析所选邮件。');
  const first = screen.getByRole('tab', { name: '待办' });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: '跨邮件分析' })).toHaveFocus();
  expect(screen.getByRole('tabpanel', { name: '跨邮件分析' })).toBeVisible();
  expect(api.startTaskBatch).not.toHaveBeenCalled();
  expect(api.runPendingTasks).not.toHaveBeenCalled();
});
