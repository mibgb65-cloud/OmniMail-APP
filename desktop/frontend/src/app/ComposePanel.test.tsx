import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../lib/bridge/mail';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { ComposePanel } from './ComposePanel';
import { ComposeSender } from './ComposeSender';
import { useComposer } from './useComposer';

vi.mock('../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../lib/bridge/mail')>()),
  send: vi.fn(),
}));
const accounts: api.AccountSummary[] = ['first', 'second', 'offline'].map((id) => ({
  id,
  providerCode: 'custom',
  email: `${id}@example.invalid`,
  displayName: '同名账号',
  status: id === 'offline' ? AccountStatus.AccountDisconnected : AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
}));
function Harness() {
  const composer = useComposer(accounts, vi.fn());
  return (
    <>
      <button onClick={() => composer.open('first')}>
        {composer.hasSession ? '恢复会话' : '开始写信'}
      </button>
      <p>列表仍可使用</p>
      <ComposePanel composer={composer} accounts={accounts} />
    </>
  );
}
const setup = () =>
  render(
    <I18nProvider initialLocale="zh-CN">
      <Harness />
    </I18nProvider>,
  );
beforeEach(() => {
  vi.mocked(api.send).mockReset().mockResolvedValue(undefined);
});

it('工作区无居中撰写模态，返回恢复输入，发件人完整地址可辨认', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '开始写信' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '写邮件' })).toBeVisible();
  expect(screen.getByText('列表仍可使用')).toBeVisible();
  expect(screen.getByLabelText('收件人')).toHaveFocus();
  expect(screen.getByRole('combobox', { name: '发件人' })).toHaveTextContent(
    'first@example.invalid',
  );
  fireEvent.change(screen.getByLabelText('收件人'), {
    target: { value: 'recipient@example.invalid' },
  });
  fireEvent.change(screen.getByLabelText('主题'), { target: { value: '工作区主题' } });
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: '暂时返回仍保留正文' } });
  fireEvent.click(screen.getByRole('button', { name: '返回邮件' }));
  expect(screen.queryByRole('region', { name: '写邮件' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '恢复会话' }));
  expect(screen.getByLabelText('收件人')).toHaveValue('recipient@example.invalid');
  expect(screen.getByLabelText('正文')).toHaveValue('暂时返回仍保留正文');
  expect(screen.getByText(/仅在本次应用会话/)).toBeVisible();
});

it('发送结果不确定保留内容并禁止直接重发，不将其冒称失败或可以撤回', async () => {
  vi.mocked(api.send).mockRejectedValue(new Error('SEND_UNCERTAIN private-marker'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: '开始写信' }));
  fireEvent.change(screen.getByLabelText('收件人'), {
    target: { value: 'recipient@example.invalid' },
  });
  fireEvent.change(screen.getByLabelText('主题'), { target: { value: '安全发送' } });
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('勿直接重复发送');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private-marker');
  expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  expect(screen.getByLabelText('正文')).toHaveValue('Hello');
  fireEvent.click(screen.getByRole('button', { name: '返回邮件' }));
  fireEvent.click(screen.getByRole('button', { name: '恢复会话' }));
  fireEvent.keyDown(screen.getByLabelText('正文'), { key: 'Enter', ctrlKey: true });
  expect(api.send).toHaveBeenCalledOnce();
});

it('有输入时放弃需要确认，继续编辑不清除，确认后才销毁会话', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '开始写信' }));
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: '不能直接丢失' } });
  fireEvent.click(screen.getByRole('button', { name: '放弃' }));
  const dialog = await screen.findByRole('dialog', { name: '放弃这封邮件？' });
  expect(screen.getByLabelText('正文')).toHaveValue('不能直接丢失');
  fireEvent.click(within(dialog).getByRole('button', { name: '继续编辑' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByLabelText('正文')).toHaveValue('不能直接丢失');
  fireEvent.click(screen.getByRole('button', { name: '放弃' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '放弃' }));
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: '写邮件' })).not.toBeInTheDocument(),
  );
});

it('普通 Enter 在单行字段间导航而不发送，快捷键发送也必须经空内容确认', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '开始写信' }));
  fireEvent.change(screen.getByLabelText('收件人'), {
    target: { value: 'recipient@example.invalid' },
  });
  fireEvent.keyDown(screen.getByLabelText('收件人'), { key: 'Enter' });
  expect(screen.getByLabelText('主题')).toHaveFocus();
  expect(api.send).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByLabelText('正文'), { key: 'Enter', metaKey: true });
  const confirm = await screen.findByRole('dialog', { name: '确认发送这封邮件？' });
  expect(api.send).not.toHaveBeenCalled();
  fireEvent.click(within(confirm).getByRole('button', { name: '仍然发送' }));
  await screen.findByRole('status');
  await waitFor(() => expect(api.send).toHaveBeenCalledOnce());
});

it('账号选择器限高、完整地址、禁用失效项，方向键与 Escape 不触发发送', () => {
  const changed = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <ComposeSender accounts={accounts} value="" disabled={false} onChange={changed} />
    </I18nProvider>,
  );
  const trigger = screen.getByRole('combobox', { name: '发件人' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(screen.getByRole('listbox')).toBeVisible();
  expect(screen.getByRole('option', { name: /offline@example.invalid/ })).toBeDisabled();
  fireEvent.keyDown(trigger, { key: 'End' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(changed).toHaveBeenCalledExactlyOnceWith('second');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
