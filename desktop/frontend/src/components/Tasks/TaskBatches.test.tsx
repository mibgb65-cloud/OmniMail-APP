import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../../lib/bridge/tasks';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { TaskBatches } from './TaskBatches';
import { mail, prefs } from './fixtures';
vi.mock('../../lib/bridge/tasks', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/tasks')>()),
  startTaskBatch: vi.fn(),
  stopTasks: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api.startTaskBatch).mockReset().mockResolvedValue('run_test');
  vi.mocked(api.stopTasks).mockReset().mockResolvedValue(undefined);
});
it('不自动处理或重试；用户选择邮件和未知重试授权后才发起后台批次', async () => {
  const changed = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <TaskBatches mails={[mail]} runs={[]} prefs={prefs} running={false} onChanged={changed} />
    </I18nProvider>,
  );
  expect(api.startTaskBatch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: '选择邮件 synthetic mail' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /允许重试已外发/ }));
  fireEvent.click(screen.getByRole('button', { name: '分析所选邮件' }));
  await waitFor(() =>
    expect(api.startTaskBatch).toHaveBeenCalledWith([mail.id], true, expect.any(AbortSignal)),
  );
  expect(changed).toHaveBeenCalledOnce();
});
it('停止不显示为新批次已开始', async () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <TaskBatches mails={[]} runs={[]} prefs={prefs} running onChanged={vi.fn()} />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '停止当前批次' }));
  await waitFor(() => expect(api.stopTasks).toHaveBeenCalledOnce());
  expect(screen.queryByText(/^后台批次已开始/)).not.toBeInTheDocument();
});
