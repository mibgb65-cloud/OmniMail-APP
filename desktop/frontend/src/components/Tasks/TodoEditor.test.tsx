import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../../lib/bridge/tasks';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { TodoEditor } from './TodoEditor';
import { account, details, todo } from './fixtures';
vi.mock('../../lib/bridge/tasks', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/tasks')>()),
  todoDetail: vi.fn(),
  editTodo: vi.fn(),
  resolveTodo: vi.fn(),
  deleteTodo: vi.fn(),
  taskSource: vi.fn(),
}));
beforeEach(() => {
  const source = details.sources[0];
  if (!source) throw new Error('缺少合成来源夹具');
  vi.mocked(api.todoDetail).mockReset().mockResolvedValue(details);
  vi.mocked(api.editTodo)
    .mockReset()
    .mockResolvedValue({ ...todo, version: 2 });
  vi.mocked(api.resolveTodo).mockReset().mockResolvedValue(undefined);
  vi.mocked(api.deleteTodo).mockReset().mockResolvedValue(undefined);
  vi.mocked(api.taskSource)
    .mockReset()
    .mockResolvedValue({ source, body: '<script>unsafe()</script>', changed: true, error: '' });
});
async function setup() {
  const close = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <TodoEditor id={todo.id} accounts={[account]} onClose={close} onSaved={vi.fn()} />
    </I18nProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('事项标题')).toHaveValue(todo.title));
  expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  return close;
}
it('人工未保存修改阻止采用建议；版本冲突保留表单而不是覆盖', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('事项标题'), { target: { value: 'human edit' } });
  expect(screen.getByRole('button', { name: '采用此变更' })).toBeDisabled();
  vi.mocked(api.editTodo).mockRejectedValueOnce(new Error('TASK_CONFLICT'));
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('事项标题')).toHaveValue('human edit');
  expect(api.resolveTodo).not.toHaveBeenCalled();
});
it('来源只读显示为文本，删除与丢弃均需明确操作', async () => {
  const close = await setup();
  fireEvent.click(screen.getByRole('button', { name: '查看本地原文（不标已读）' }));
  await screen.findByText('<script>unsafe()</script>');
  expect(document.querySelector('script')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '删除事项及其引文' }));
  expect(api.deleteTodo).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '删除这件待办？' })).getByRole('button', {
      name: '返回',
    }),
  );
  fireEvent.change(screen.getByLabelText('个人备注（不会发送给 AI）'), {
    target: { value: 'unsaved' },
  });
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '放弃未保存的修改？' })).getByRole('button', {
      name: '放弃修改',
    }),
  );
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});
it('采用建议后的重新读取期间不能编辑旧版本表单', async () => {
  await setup();
  vi.mocked(api.todoDetail).mockReturnValueOnce(new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: '采用此变更' }));
  await waitFor(() => expect(api.todoDetail).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('事项标题')).toBeDisabled();
  expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
});
