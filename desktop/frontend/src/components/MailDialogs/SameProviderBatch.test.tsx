import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AccountStatus, Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
import * as api from '../../lib/bridge/mail';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { AccountDialog } from './AccountDialog';

vi.mock('../../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/mail')>()),
  providers: vi.fn(),
  addAccount: vi.fn(),
}));

const presets: api.ProviderPreset[] = ['gmail', 'custom'].map((code) => ({
  code,
  name: code,
  authKinds: [api.AuthKind.AuthPassword],
  endpoints: [
    {
      protocol: Protocol.ProtocolIMAP,
      host: code === 'custom' ? '' : 'imap.gmail.com',
      port: 993,
      tlsMode: api.TLSMode.TLSImplicit,
    },
    {
      protocol: Protocol.ProtocolSMTP,
      host: code === 'custom' ? '' : 'smtp.gmail.com',
      port: 465,
      tlsMode: api.TLSMode.TLSImplicit,
    },
  ],
}));
function summary(email: string): api.AccountSummary {
  return {
    id: `test-${email}`,
    email,
    displayName: '',
    providerCode: 'gmail',
    status: AccountStatus.AccountConfigured,
    sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
  };
}
async function setup() {
  const onClose = vi.fn(),
    onSaved = vi.fn();
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <AccountDialog onClose={onClose} onSaved={onSaved} />
    </I18nProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Gmail' }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'first@gmail.com' } });
  fireEvent.change(screen.getByLabelText('应用专用密码'), { target: { value: 'test-first-code' } });
  return { ...view, onClose, onSaved };
}
function addSecond() {
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  const row = within(screen.getByRole('group', { name: '账号 2' }));
  fireEvent.change(row.getByLabelText('邮箱地址'), { target: { value: 'second@gmail.com' } });
  fireEvent.change(row.getByLabelText('应用专用密码'), { target: { value: 'test-second-code' } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.addAccount).mockReset();
  localStorage.clear();
  vi.mocked(api.providers).mockResolvedValue(presets);
});

it('Gmail 不显示顶部填写说明，仍保留应用专用密码提示', async () => {
  await setup();
  expect(screen.queryByText('填写 Gmail 地址和应用专用密码。')).not.toBeInTheDocument();
  expect(screen.getByText(/不是 Google 登录密码/)).toBeVisible();
});

it.each([
  ['AUTH_INVALID', 'Gmail 拒绝了登录'],
  ['NETWORK_FAILED', '无法连接 Gmail 收发信服务器'],
])('单个 Gmail 的 %s 显示对应指引，不显示服务器原文', async (code, message) => {
  vi.mocked(api.addAccount).mockRejectedValueOnce(new Error(`${code} private-server-marker`));
  const view = await setup();
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
  expect(screen.getByRole('alert')).toHaveFocus();
  expect(screen.queryByText(/private-server-marker/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('应用专用密码')).toBeEnabled();
  expect(view.onSaved).not.toHaveBeenCalled();
});

it('批量 Gmail 的失败项使用同一认证指引，不影响成功项', async () => {
  vi.mocked(api.addAccount)
    .mockRejectedValueOnce(new Error('AUTH_INVALID private-server-marker'))
    .mockResolvedValueOnce(summary('second@gmail.com'));
  const view = await setup();
  addSecond();
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByText(/Gmail 拒绝了登录/)).toBeVisible());
  expect(screen.queryByText(/private-server-marker/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重试未添加账号' })).toBeEnabled();
});

it('自定义服务商保留通用认证错误，不错误提示 Google 账号', async () => {
  vi.mocked(api.addAccount).mockRejectedValueOnce(new Error('AUTH_INVALID private-server-marker'));
  await setup();
  fireEvent.click(screen.getByRole('button', { name: '返回选择服务商' }));
  fireEvent.click(screen.getByRole('button', { name: '自定义 IMAP/SMTP' }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), {
    target: { value: 'person@example.invalid' },
  });
  const incoming = within(screen.getByRole('group', { name: 'IMAP' }));
  const outgoing = within(screen.getByRole('group', { name: 'SMTP' }));
  for (const group of [incoming, outgoing]) {
    fireEvent.change(group.getByLabelText('服务器'), { target: { value: 'mail.example.invalid' } });
  }
  fireEvent.change(incoming.getByLabelText('登录用户名'), {
    target: { value: 'person@example.invalid' },
  });
  fireEvent.change(incoming.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'synthetic-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('服务器拒绝登录'));
  expect(screen.queryByText(/Gmail 拒绝了登录/)).not.toBeInTheDocument();
  expect(screen.queryByText(/private-server-marker/)).not.toBeInTheDocument();
});

it('同服务商可填写多组独立邮箱和应用密码，不重复展示协议或选择其他服务商', async () => {
  await setup();
  addSecond();
  expect(screen.getByRole('group', { name: '账号 1' })).toBeVisible();
  expect(screen.getByRole('group', { name: '账号 2' })).toBeVisible();
  expect(screen.getByRole('button', { name: '验证并添加 2 个账号' })).toBeEnabled();
  expect(screen.queryByRole('group', { name: 'IMAP' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'QQ 邮箱' })).not.toBeInTheDocument();
});

it('串行添加，部分失败可修改后只重试失败项，成功项不重复添加', async () => {
  const pending: Array<{
    resolve: (account: api.AccountSummary) => void;
    reject: (error: Error) => void;
  }> = [];
  vi.mocked(api.addAccount).mockImplementation(
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
  );
  const view = await setup();
  addSecond();
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  expect(api.addAccount).toHaveBeenCalledOnce();
  const first = pending[0];
  if (!first) throw new Error('第一个请求未开始');
  await act(async () => first.resolve(summary('first@gmail.com')));
  await waitFor(() => expect(api.addAccount).toHaveBeenCalledTimes(2));
  expect(view.onSaved).toHaveBeenCalledOnce();
  const second = pending[1];
  if (!second) throw new Error('第二个请求未开始');
  await act(async () => second.reject(new Error('AUTH_INVALID private-test-marker')));
  expect(screen.queryByText(/private-test-marker/)).not.toBeInTheDocument();
  const retryRow = within(screen.getByRole('group', { name: '账号 2' }));
  fireEvent.change(retryRow.getByLabelText('应用专用密码'), {
    target: { value: 'fixed-second-code' },
  });
  fireEvent.click(screen.getByRole('button', { name: '重试未添加账号' }));
  expect(api.addAccount).toHaveBeenCalledTimes(3);
  expect(vi.mocked(api.addAccount).mock.calls[2]?.[0]).toEqual(
    expect.objectContaining({
      email: 'second@gmail.com',
      providerCode: 'gmail',
      imap: expect.objectContaining({
        username: 'second@gmail.com',
        password: 'fixed-second-code',
      }),
      smtp: expect.objectContaining({
        username: 'second@gmail.com',
        password: 'fixed-second-code',
      }),
    }),
  );
  const retried = pending[2];
  if (!retried) throw new Error('失败项未重试');
  await act(async () => retried.resolve(summary('second@gmail.com')));
  expect(screen.getByRole('heading', { name: '同步邮件' })).toBeVisible();
  expect(view.onSaved).toHaveBeenCalledTimes(2);
  expect(screen.queryByLabelText('应用专用密码')).not.toBeInTheDocument();
  expect(storage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '完成' }));
  expect(view.onClose).toHaveBeenCalledOnce();
});

it('批内重复邮箱在发送前提示，不能借大小写绕过去重', async () => {
  await setup();
  addSecond();
  const row = within(screen.getByRole('group', { name: '账号 2' }));
  fireEvent.change(row.getByLabelText('邮箱地址'), { target: { value: 'FIRST@GMAIL.COM' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  expect(screen.getByRole('alert')).toHaveTextContent('同批邮箱不能重复');
  expect(screen.getByRole('alert')).toHaveFocus();
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('批量上限为 10，移除账号保持其他草稿和密码的身份，不触发请求', async () => {
  await setup();
  addSecond();
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  const third = within(screen.getByRole('group', { name: '账号 3' }));
  fireEvent.change(third.getByLabelText('邮箱地址'), { target: { value: 'third@gmail.com' } });
  fireEvent.change(third.getByLabelText('应用专用密码'), { target: { value: 'third-test-code' } });
  fireEvent.click(screen.getByRole('button', { name: '移除账号 2' }));
  const promoted = within(screen.getByRole('group', { name: '账号 2' }));
  expect(promoted.getByLabelText('邮箱地址')).toHaveValue('third@gmail.com');
  expect(promoted.getByLabelText('应用专用密码')).toHaveValue('third-test-code');
  for (let index = 2; index < 10; index++) {
    fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  }
  expect(screen.getByRole('button', { name: '添加同服务商账号' })).toBeDisabled();
  expect(screen.getByRole('group', { name: '账号 10' })).toBeVisible();
  expect(screen.queryByRole('group', { name: '账号 11' })).not.toBeInTheDocument();
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('部分成功后关闭只取消当前等待，不提交后项，不回滚已成功账号', async () => {
  const pending: Array<(account: api.AccountSummary) => void> = [];
  vi.mocked(api.addAccount).mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const view = await setup();
  addSecond();
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  const third = within(screen.getByRole('group', { name: '账号 3' }));
  fireEvent.change(third.getByLabelText('邮箱地址'), { target: { value: 'third@gmail.com' } });
  fireEvent.change(third.getByLabelText('应用专用密码'), { target: { value: 'third-test-code' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 3 个账号' }));
  const first = pending[0];
  if (!first) throw new Error('没有开始第一个请求');
  await act(async () => first(summary('first@gmail.com')));
  await waitFor(() => expect(api.addAccount).toHaveBeenCalledTimes(2));
  const signal = vi.mocked(api.addAccount).mock.calls[1]?.[1];
  view.unmount();
  expect(signal?.aborted).toBe(true);
  const second = pending[1];
  if (!second) throw new Error('没有开始第二个请求');
  await act(async () => second(summary('second@gmail.com')));
  expect(api.addAccount).toHaveBeenCalledTimes(2);
  expect(view.onSaved).toHaveBeenCalledOnce();
});

it('结果不确定的创建锁定待核对，不把超时当普通失败重试', async () => {
  vi.mocked(api.addAccount)
    .mockRejectedValueOnce(new Error('TIMEOUT'))
    .mockResolvedValueOnce(summary('second@gmail.com'));
  const view = await setup();
  addSecond();
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
  expect(screen.getByText(/结果不确定，请先在邮箱核对/)).toBeVisible();
  expect(screen.getByRole('button', { name: '重试未添加账号' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('form', { name: '配置 Gmail' }));
  expect(api.addAccount).toHaveBeenCalledTimes(2);
  expect(screen.queryByLabelText('应用专用密码')).not.toBeInTheDocument();
});

it('同一自定义服务商共用服务器，但每个账号有独立收发信凭据', async () => {
  const pending: Array<(account: api.AccountSummary) => void> = [];
  vi.mocked(api.addAccount).mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <AccountDialog onClose={vi.fn()} onSaved={vi.fn()} />
    </I18nProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: '自定义 IMAP/SMTP' }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'one@example.invalid' } });
  const incoming = within(screen.getByRole('group', { name: 'IMAP' }));
  fireEvent.change(incoming.getByLabelText('服务器'), {
    target: { value: 'imap.shared.example.invalid' },
  });
  fireEvent.change(incoming.getByLabelText('登录用户名'), { target: { value: 'incoming-one' } });
  fireEvent.change(incoming.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'incoming-one-secret' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  const outgoing = within(screen.getByRole('group', { name: 'SMTP' }));
  fireEvent.change(outgoing.getByLabelText('服务器'), {
    target: { value: 'smtp.shared.example.invalid' },
  });
  fireEvent.change(outgoing.getByLabelText('登录用户名'), { target: { value: 'outgoing-one' } });
  fireEvent.change(outgoing.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'outgoing-one-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  expect(screen.getByRole('group', { name: '共用服务器配置' })).toBeVisible();
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  for (const [label, value] of [
    ['邮箱地址', 'two@example.invalid'],
    ['收信登录用户名', 'incoming-two'],
    ['收信密码 / 应用授权码', 'incoming-two-secret'],
    ['发信登录用户名', 'outgoing-two'],
    ['发信密码 / 应用授权码', 'outgoing-two-secret'],
  ]) {
    if (label && value) fireEvent.change(second.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  expect(vi.mocked(api.addAccount).mock.calls[0]?.[0]).toEqual(
    expect.objectContaining({
      providerCode: 'custom',
      imap: expect.objectContaining({
        host: 'imap.shared.example.invalid',
        username: 'incoming-one',
      }),
      smtp: expect.objectContaining({
        host: 'smtp.shared.example.invalid',
        username: 'outgoing-one',
      }),
    }),
  );
  const first = pending[0];
  if (!first) throw new Error('没有开始第一个自定义账号');
  await act(async () => first({ ...summary('one@example.invalid'), providerCode: 'custom' }));
  await waitFor(() => expect(api.addAccount).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.addAccount).mock.calls[1]?.[0]).toEqual(
    expect.objectContaining({
      providerCode: 'custom',
      imap: expect.objectContaining({
        host: 'imap.shared.example.invalid',
        username: 'incoming-two',
        password: 'incoming-two-secret',
      }),
      smtp: expect.objectContaining({
        host: 'smtp.shared.example.invalid',
        username: 'outgoing-two',
        password: 'outgoing-two-secret',
      }),
    }),
  );
  view.unmount();
});
