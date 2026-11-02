import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import * as mail from '../../lib/bridge/mail';
import * as templates from '../../lib/bridge/customProviders';
import { AccountStatus, Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
import { AccountDialog } from './AccountDialog';

vi.mock('../../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/mail')>()),
  providers: vi.fn(),
  addAccount: vi.fn(),
}));
vi.mock('../../lib/bridge/customProviders', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/customProviders')>()),
  supportsCustomProviders: () => true,
  listCustomProviders: vi.fn(),
  createCustomProvider: vi.fn(),
}));
const preset = {
  code: 'saved_' + 'a'.repeat(32),
  name: '企业邮箱',
  authKinds: [mail.AuthKind.AuthPassword],
  endpoints: [
    {
      protocol: Protocol.ProtocolIMAP,
      host: 'imap.example.invalid',
      port: 993,
      tlsMode: mail.TLSMode.TLSImplicit,
    },
    {
      protocol: Protocol.ProtocolSMTP,
      host: 'smtp.example.invalid',
      port: 587,
      tlsMode: mail.TLSMode.TLSStartTLS,
    },
  ],
} satisfies mail.ProviderPreset;
const builtin: mail.ProviderPreset = {
  ...preset,
  code: 'custom',
  name: '自定义 IMAP/SMTP',
  endpoints: preset.endpoints.map((endpoint) => ({ ...endpoint, host: '' })),
};
beforeEach(() => {
  vi.mocked(mail.providers)
    .mockReset()
    .mockResolvedValue([builtin, { ...preset, code: 'qq', name: 'QQ 邮箱' }]);
  vi.mocked(mail.addAccount).mockReset();
  vi.mocked(templates.listCustomProviders).mockReset().mockResolvedValue([]);
  vi.mocked(templates.createCustomProvider).mockReset().mockResolvedValue(preset);
});
function setup() {
  const saved = vi.fn();
  return {
    saved,
    ...render(
      <I18nProvider initialLocale="zh-CN">
        <AccountDialog onClose={vi.fn()} onSaved={saved} />
      </I18nProvider>,
    ),
  };
}
function fillServers(editor: HTMLElement) {
  fireEvent.change(within(editor).getByRole('textbox', { name: '服务商名称' }), {
    target: { value: preset.name },
  });
  fireEvent.change(
    within(within(editor).getByRole('group', { name: 'IMAP' })).getByLabelText('服务器'),
    { target: { value: 'imap.example.invalid' } },
  );
  fireEvent.change(
    within(within(editor).getByRole('group', { name: 'SMTP' })).getByLabelText('服务器'),
    { target: { value: 'smtp.example.invalid' } },
  );
  fireEvent.change(
    within(within(editor).getByRole('group', { name: 'SMTP' })).getByLabelText('端口'),
    { target: { value: '587' } },
  );
  fireEvent.change(
    within(within(editor).getByRole('group', { name: 'SMTP' })).getByLabelText('连接安全'),
    { target: { value: 'starttls' } },
  );
}
it('创建后立即可用、返回选择页显示，重新打开仅填凭据即可提交原有账号验证', async () => {
  const view = setup();
  fireEvent.click(await screen.findByRole('button', { name: '添加自定义服务商' }));
  const editor = screen.getByRole('dialog', { name: '添加自定义服务商' });
  expect(within(editor).queryByLabelText('密码 / 应用授权码')).not.toBeInTheDocument();
  fillServers(editor);
  fireEvent.click(within(editor).getByRole('button', { name: '保存并使用' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '添加自定义服务商' })).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('heading', { name: '配置 企业邮箱' })).toBeVisible();
  expect(screen.queryByLabelText('服务器')).not.toBeInTheDocument();
  expect(view.saved).not.toHaveBeenCalled();
  expect(templates.createCustomProvider).toHaveBeenCalledWith(
    {
      name: '企业邮箱',
      imap: { host: 'imap.example.invalid', port: 993, tlsMode: 'implicit_tls' },
      smtp: { host: 'smtp.example.invalid', port: 587, tlsMode: 'starttls' },
    },
    expect.any(AbortSignal),
  );
  fireEvent.click(screen.getByRole('button', { name: '返回选择服务商' }));
  expect(screen.getByRole('button', { name: '企业邮箱' })).toBeVisible();
  view.unmount();
  vi.mocked(templates.listCustomProviders).mockResolvedValue([preset]);
  const reopened = setup();
  fireEvent.click(await screen.findByRole('button', { name: '企业邮箱' }));
  expect(screen.getByLabelText('邮箱地址')).toHaveValue('');
  expect(screen.getByLabelText('登录用户名')).toHaveValue('');
  expect(screen.getByLabelText('密码 / 应用授权码')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('邮箱地址'), {
    target: { value: 'person@example.invalid' },
  });
  fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'account-only-secret' },
  });
  vi.mocked(mail.addAccount).mockResolvedValue({
    id: 'test-account',
    email: 'person@example.invalid',
    providerCode: 'custom',
    displayName: '',
    status: AccountStatus.AccountConfigured,
    sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  await waitFor(() => expect(reopened.saved).toHaveBeenCalledOnce());
  expect(mail.addAccount).toHaveBeenCalledWith(
    expect.objectContaining({
      providerCode: 'custom',
      imap: expect.objectContaining({
        host: 'imap.example.invalid',
        username: 'person@example.invalid',
        password: 'account-only-secret',
      }),
      smtp: expect.objectContaining({
        host: 'smtp.example.invalid',
        port: 587,
        tlsMode: 'starttls',
        password: 'account-only-secret',
      }),
    }),
    expect.any(AbortSignal),
  );
});
it('从手动表单保存只投影连接参数，当前账号与密码不丢失也不进入模板', async () => {
  setup();
  fireEvent.click(await screen.findByRole('button', { name: '自定义 IMAP/SMTP' }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), {
    target: { value: 'private@example.invalid' },
  });
  const imap = screen.getByRole('group', { name: 'IMAP' });
  const smtp = screen.getByRole('group', { name: 'SMTP' });
  fireEvent.change(within(imap).getByLabelText('服务器'), {
    target: { value: 'imap.example.invalid' },
  });
  fireEvent.change(within(smtp).getByLabelText('服务器'), {
    target: { value: 'smtp.example.invalid' },
  });
  fireEvent.change(within(imap).getByLabelText('密码 / 应用授权码'), {
    target: { value: 'private-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存为服务商' }));
  const editor = screen.getByRole('dialog', { name: '添加自定义服务商' });
  expect(
    within(within(editor).getByRole('group', { name: 'IMAP' })).getByLabelText('服务器'),
  ).toHaveValue('imap.example.invalid');
  fireEvent.change(within(editor).getByLabelText('服务商名称'), { target: { value: '企业邮箱' } });
  fireEvent.click(within(editor).getByRole('button', { name: '保存并使用' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '添加自定义服务商' })).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText('邮箱地址')).toHaveValue('private@example.invalid');
  expect(screen.getByLabelText('密码 / 应用授权码')).toHaveValue('private-secret');
  const payload = vi.mocked(templates.createCustomProvider).mock.calls[0]?.[0];
  expect(JSON.stringify(payload)).not.toMatch(/private|password|username|authKind/);
});
it('读取失败不隐藏内置服务商，保存重名错误不误报成功', async () => {
  vi.mocked(templates.listCustomProviders).mockRejectedValue(new Error('private-diagnostic'));
  setup();
  expect(await screen.findByRole('button', { name: 'QQ 邮箱' })).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('无法读取已保存的服务商');
  fireEvent.click(screen.getByRole('button', { name: '添加自定义服务商' }));
  const editor = screen.getByRole('dialog', { name: '添加自定义服务商' });
  fillServers(editor);
  vi.mocked(templates.createCustomProvider).mockRejectedValue(
    new Error('PROVIDER_NAME_EXISTS private'),
  );
  fireEvent.click(within(editor).getByRole('button', { name: '保存并使用' }));
  expect(await within(editor).findByRole('alert')).toHaveTextContent('已有同名服务商');
  expect(within(editor).getByRole('alert')).not.toHaveTextContent('private');
  expect(editor).toHaveAttribute('open');
});
