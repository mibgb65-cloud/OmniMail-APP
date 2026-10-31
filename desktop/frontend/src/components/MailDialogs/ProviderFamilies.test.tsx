import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const presets: api.ProviderPreset[] = ['netease_163', 'netease_126', 'linuxdo'].map((code) => {
  const domain = code === 'netease_163' ? '163.com' : '126.com';
  return {
    code,
    name: code === 'linuxdo' ? 'LINUX DO Mail' : code,
    authKinds: [api.AuthKind.AuthPassword],
    endpoints: [
      {
        protocol: Protocol.ProtocolIMAP,
        host: code === 'linuxdo' ? 'mail.linux.do' : `imap.${domain}`,
        port: 993,
        tlsMode: api.TLSMode.TLSImplicit,
      },
      {
        protocol: Protocol.ProtocolSMTP,
        host: code === 'linuxdo' ? 'mail.linux.do' : `smtp.${domain}`,
        port: 465,
        tlsMode: api.TLSMode.TLSImplicit,
      },
    ],
  };
});
function setup() {
  return render(
    <I18nProvider initialLocale="zh-CN">
      <AccountDialog onClose={vi.fn()} onSaved={vi.fn()} />
    </I18nProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.addAccount).mockReset();
  vi.mocked(api.providers).mockResolvedValue(presets);
  vi.mocked(api.addAccount).mockReturnValue(new Promise(() => {}));
});

it('网易只有一个品牌入口，LinuxDo 显示本地官方品牌图标', async () => {
  setup();
  expect(await screen.findByRole('button', { name: '网易邮箱' })).toBeVisible();
  expect(screen.getAllByRole('button', { name: '网易邮箱' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /网易 163|网易 126/ })).not.toBeInTheDocument();
  const linuxdo = screen.getByRole('button', { name: 'LINUX DO Mail' });
  expect(linuxdo.querySelector('img')).toHaveAttribute('src', '/providers/linuxdo.png');
  expect(linuxdo.querySelector('img')).toHaveAttribute('alt', '');
});

it('LinuxDo 使用官方 TLS 端点、完整邮箱用户名和独立专用令牌', async () => {
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'LINUX DO Mail' }));
  expect(screen.getByText(/专用认证令牌/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'person@linux.do' } });
  fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'synthetic-linux-token' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  expect(api.addAccount).toHaveBeenCalledWith(
    expect.objectContaining({
      providerCode: 'linuxdo',
      imap: expect.objectContaining({
        host: 'mail.linux.do',
        port: 993,
        username: 'person@linux.do',
        password: 'synthetic-linux-token',
        tlsMode: api.TLSMode.TLSImplicit,
      }),
      smtp: expect.objectContaining({
        host: 'mail.linux.do',
        port: 465,
        username: 'person@linux.do',
        password: 'synthetic-linux-token',
        tlsMode: api.TLSMode.TLSImplicit,
      }),
    }),
    expect.any(AbortSignal),
  );
});

it.each([
  ['163.com', 'netease_163'],
  ['126.com', 'netease_126'],
])('网易品牌入口按 %s 分配真实子预设 %s', async (domain, code) => {
  setup();
  fireEvent.click(await screen.findByRole('button', { name: '网易邮箱' }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: `person@${domain}` } });
  fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'synthetic-netease-code' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  expect(api.addAccount).toHaveBeenCalledWith(
    expect.objectContaining({
      providerCode: code,
      imap: expect.objectContaining({ host: `imap.${domain}`, username: `person@${domain}` }),
      smtp: expect.objectContaining({ host: `smtp.${domain}`, port: 465 }),
    }),
    expect.any(AbortSignal),
  );
});

it('同一网易批次可混合 163 和 126，每行独立选择端点并保留各自密码', async () => {
  vi.mocked(api.addAccount).mockImplementation(async (input) => ({
    id: `account-${input.providerCode}`,
    email: input.email,
    displayName: '',
    providerCode: input.providerCode,
    status: AccountStatus.AccountConfigured,
    sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
  }));
  setup();
  fireEvent.click(await screen.findByRole('button', { name: '网易邮箱' }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'first@163.com' } });
  fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'synthetic-first' },
  });
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  fireEvent.change(second.getByLabelText('邮箱地址'), { target: { value: 'second@126.com' } });
  fireEvent.change(second.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'synthetic-second' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  await waitFor(() => expect(api.addAccount).toHaveBeenCalledTimes(2));
  const values = vi
    .mocked(api.addAccount)
    .mock.calls.map(([input]) => [
      input.providerCode,
      input.imap.host,
      input.smtp.host,
      input.imap.password,
    ]);
  expect(values).toEqual([
    ['netease_163', 'imap.163.com', 'smtp.163.com', 'synthetic-first'],
    ['netease_126', 'imap.126.com', 'smtp.126.com', 'synthetic-second'],
  ]);
});

it('网易入口对未确认的 162 域名拒绝提交，不误用 126 或 163 服务器', async () => {
  setup();
  fireEvent.click(await screen.findByRole('button', { name: '网易邮箱' }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'person@162.com' } });
  fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'synthetic-code' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(api.addAccount).not.toHaveBeenCalled();
});
