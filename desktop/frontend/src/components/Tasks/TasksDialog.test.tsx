import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../../lib/bridge/tasks';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { TasksDialog } from './TasksDialog';
import { account, mail, prefs, todo } from './fixtures';
import { aiConfig } from '../../lib/bridge/ai';
vi.mock('../../lib/bridge/tasks', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/tasks')>()),
  listTodos: vi.fn(),
  todoCounts: vi.fn(),
  taskRuns: vi.fn(),
  taskPreferences: vi.fn(),
  taskState: vi.fn(),
  startTaskBatch: vi.fn(),
  runPendingTasks: vi.fn(),
  saveTaskPreferences: vi.fn(),
}));
vi.mock('../../lib/bridge/ai', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/ai')>()),
  aiConfig: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api.listTodos).mockResolvedValue([]);
  vi.mocked(api.todoCounts).mockResolvedValue({
    all: 0,
    suggested: 0,
    open: 0,
    waiting: 0,
    done: 0,
    dismissed: 0,
  });
  vi.mocked(api.taskRuns).mockResolvedValue([]);
  vi.mocked(api.taskPreferences).mockResolvedValue(prefs);
  vi.mocked(api.taskState).mockResolvedValue({ running: false, runId: '', error: '' });
  vi.mocked(api.startTaskBatch).mockReset();
  vi.mocked(api.runPendingTasks).mockReset();
  vi.mocked(aiConfig).mockResolvedValue({
    endpoint: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    language: 'zh',
    consent: true,
    hasKey: true,
    revision: 'ai_1',
  });
});
it('切换分类保留设置草稿，关闭须确认且不会把未保存修改当作生效', async () => {
  const close = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <TasksDialog accounts={[account]} mails={[mail]} onClose={close} />
    </I18nProvider>,
  );
  await screen.findByRole('heading', { name: '从第一件待办开始' });
  fireEvent.click(screen.getByRole('tab', { name: '每日设置' }));
  const limit = await screen.findByLabelText('每批最多处理封数（1–100）');
  fireEvent.change(limit, { target: { value: '30' } });
  fireEvent.click(screen.getByRole('tab', { name: '待办' }));
  fireEvent.click(screen.getByRole('tab', { name: '每日设置' }));
  expect(screen.getByLabelText('每批最多处理封数（1–100）')).toHaveValue(30);
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  const confirmation = screen.getByRole('dialog', { name: '放弃未保存的设置？' });
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(within(confirmation).getByRole('button', { name: '继续编辑' }));
  expect(screen.getByLabelText('每批最多处理封数（1–100）')).toHaveValue(30);
  expect(api.saveTaskPreferences).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '放弃未保存的设置？' })).getByRole('button', {
      name: '放弃修改并关闭',
    }),
  );
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});
it('切换筛选后不显示上一状态的迟到数据', async () => {
  vi.mocked(api.listTodos).mockResolvedValueOnce([todo]);
  vi.mocked(api.todoCounts).mockResolvedValue({
    all: 1,
    suggested: 0,
    open: 1,
    waiting: 0,
    done: 0,
    dismissed: 0,
  });
  render(
    <I18nProvider initialLocale="zh-CN">
      <TasksDialog accounts={[account]} mails={[mail]} onClose={vi.fn()} />
    </I18nProvider>,
  );
  await screen.findByRole('button', { name: /Original task/ });
  vi.mocked(api.listTodos).mockReturnValueOnce(new Promise(() => {}));
  fireEvent.click(
    within(screen.getByRole('group', { name: '按状态筛选待办' })).getByRole('button', {
      name: /已完成/,
    }),
  );
  expect(screen.queryByRole('button', { name: /Original task/ })).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: '正在读取本地数据…' })).toBeVisible();
});
it('打开管理只读本地数据，分类键盘切换不触发分析', async () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <TasksDialog accounts={[account]} mails={[mail]} onClose={vi.fn()} />
    </I18nProvider>,
  );
  await screen.findByRole('heading', { name: '从第一件待办开始' });
  expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  const first = screen.getByRole('tab', { name: '待办' });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: '跨邮件分析' })).toHaveFocus();
  expect(screen.getByRole('tabpanel', { name: '跨邮件分析' })).toBeVisible();
  expect(api.startTaskBatch).not.toHaveBeenCalled();
  expect(api.runPendingTasks).not.toHaveBeenCalled();
});
