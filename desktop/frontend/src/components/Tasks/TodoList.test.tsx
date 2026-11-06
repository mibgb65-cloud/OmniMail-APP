import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { TodoList } from './TodoList';
import { account, todo } from './fixtures';

const empty = { all: 0, suggested: 0, open: 0, waiting: 0, done: 0, dismissed: 0 };
it('空态只有明确的新增与提取入口，不显示原生筛选或无效分页', () => {
  const edit = vi.fn(),
    sources = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <TodoList
        page={{ key: 'all:0', items: [], counts: empty }}
        counts={empty}
        filter="all"
        offset={0}
        accounts={[account]}
        onEdit={edit}
        onSources={sources}
        onFilter={vi.fn()}
        onOffset={vi.fn()}
        onRefresh={vi.fn()}
      />
    </I18nProvider>,
  );
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '新增待办' }));
  expect(edit).toHaveBeenCalledWith('');
  fireEvent.click(screen.getByRole('button', { name: '从邮件提取' }));
  expect(sources).toHaveBeenCalledOnce();
});
it('筛选为空不伪装全局无事项，计数及分页使用真实总数', () => {
  const filter = vi.fn();
  const counts = { ...empty, all: 101, open: 101 };
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <TodoList
        page={{ key: 'done:0', items: [], counts }}
        counts={counts}
        filter="done"
        offset={0}
        accounts={[account]}
        onEdit={vi.fn()}
        onSources={vi.fn()}
        onFilter={filter}
        onOffset={vi.fn()}
        onRefresh={vi.fn()}
      />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '查看全部待办' }));
  expect(filter).toHaveBeenCalledWith('all');
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <TodoList
        page={{ key: 'open:100', items: [todo], counts }}
        counts={counts}
        filter="open"
        offset={100}
        accounts={[account]}
        onEdit={vi.fn()}
        onSources={vi.fn()}
        onFilter={filter}
        onOffset={vi.fn()}
        onRefresh={vi.fn()}
      />
    </I18nProvider>,
  );
  expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  expect(screen.getByText('第 101–101 项，共 101 项')).toBeVisible();
});
