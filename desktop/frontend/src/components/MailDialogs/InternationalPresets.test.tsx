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
  accounts: vi.fn().mockResolvedValue([]),
  synchronize: vi.fn().mockResolvedValue(undefined),
}));

const providers = [
  {
    code: 'yahoo',
    label: 'Yahoo Mail',
    domain: 'yahoo.com',
    imap: 'imap.mail.yahoo.com',
    smtp: 'smtp.mail.yahoo.com',
    port: 465,
    tls: api.TLSMode.TLSImplicit,
  },
  {
    code: 'naver',
    label: 'NAVER Mail',
    domain: 'naver.com',
    imap: 'imap.naver.com',
    smtp: 'smtp.naver.com',
    port: 587,
    tls: api.TLSMode.TLSStartTLS,
  },
  {
    code: 'yandex',
    label: 'Yandex Mail',
    domain: 'yandex.com',
    imap: 'imap.yandex.com',
    smtp: 'smtp.yandex.com',
    port: 465,
    tls: api.TLSMode.TLSImplicit,
  },
  {
    code: 'icloud',
    label: 'iCloud Mail',
    domain: 'icloud.com',
    imap: 'imap.mail.me.com',
    smtp: 'smtp.mail.me.com',
    port: 587,
    tls: api.TLSMode.TLSStartTLS,
  },
] as const;
const presets: api.ProviderPreset[] = providers.map((provider) => ({
  code: provider.code,
  name: provider.label,
  authKinds: [api.AuthKind.AuthPassword],
  endpoints: [
    {
      protocol: Protocol.ProtocolIMAP,
      host: provider.imap,
      port: 993,
      tlsMode: api.TLSMode.TLSImplicit,
    },
    {
      protocol: Protocol.ProtocolSMTP,
      host: provider.smtp,
      port: provider.port,
      tlsMode: provider.tls,
    },
  ],
}));
function setup(locale: 'zh-CN' | 'en' = 'zh-CN') {
  return render(
    <I18nProvider initialLocale={locale}>
      <AccountDialog onClose={vi.fn()} onSaved={vi.fn()} />
    </I18nProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.providers).mockResolvedValue(presets);
  vi.mocked(api.addAccount).mockReturnValue(new Promise(() => {}));
});

it.each(providers)('$code 显示本地官方图标、应用密码说明并提交安全端点', async (provider) => {
  setup();
  const card = await screen.findByRole('button', { name: provider.label });
  expect(card.querySelector('img')).toHaveAttribute(
    'src',
    `/providers/${provider.code}.${provider.code === 'yahoo' ? 'png' : 'ico'}`,
  );
  fireEvent.click(card);
  const email = `person@${provider.domain}`;
  expect(screen.queryByRole('group', { name: 'SMTP' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('应用专用密码')).toHaveAttribute('type', 'password');
  expect(screen.getByText(/不要使用.*登录密码/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('应用专用密码'), {
    target: { value: 'synthetic-app-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  const username = provider.code === 'yandex' ? 'person' : email;
  expect(api.addAccount).toHaveBeenCalledWith(
    expect.objectContaining({
      providerCode: provider.code,
      email,
      imap: expect.objectContaining({
        host: provider.imap,
        port: 993,
        tlsMode: api.TLSMode.TLSImplicit,
        username,
        password: 'synthetic-app-password',
        authKind: api.AuthKind.AuthPassword,
      }),
      smtp: expect.objectContaining({
        host: provider.smtp,
        port: provider.port,
        tlsMode: provider.tls,
        username,
        password: 'synthetic-app-password',
        authKind: api.AuthKind.AuthPassword,
      }),
    }),
    expect.any(AbortSignal),
  );
});

it.each(providers)('$code 批量逐账号保留用户名、密码和正确的 TLS 模式', async (provider) => {
  const summary = (email: string): api.AccountSummary => ({
    id: email.startsWith('first') ? 'synthetic-first' : 'synthetic-second',
    email,
    displayName: '',
    providerCode: provider.code,
    status: AccountStatus.AccountConfigured,
    sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
  });
  vi.mocked(api.addAccount).mockImplementation(async (input) => summary(input.email));
  setup();
  fireEvent.click(await screen.findByRole('button', { name: provider.label }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), {
    target: { value: `first@${provider.domain}` },
  });
  fireEvent.change(screen.getByLabelText('应用专用密码'), {
    target: { value: 'synthetic-first-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  fireEvent.change(second.getByLabelText('邮箱地址'), {
    target: { value: `second@${provider.domain}` },
  });
  fireEvent.change(second.getByLabelText('应用专用密码'), {
    target: { value: 'synthetic-second-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  await waitFor(() => expect(api.addAccount).toHaveBeenCalledTimes(2));
  for (const [index, local] of ['first', 'second'].entries()) {
    const username = provider.code === 'yandex' ? local : `${local}@${provider.domain}`;
    expect(api.addAccount).toHaveBeenNthCalledWith(
      index + 1,
      expect.objectContaining({
        providerCode: provider.code,
        imap: expect.objectContaining({ username, password: `synthetic-${local}-secret` }),
        smtp: expect.objectContaining({
          host: provider.smtp,
          port: provider.port,
          tlsMode: provider.tls,
          username,
          password: `synthetic-${local}-secret`,
        }),
      }),
      expect.any(AbortSignal),
    );
  }
  expect(screen.queryByDisplayValue('synthetic-first-secret')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('synthetic-second-secret')).not.toBeInTheDocument();
});

it.each(providers)('$code 英语向导使用 App password，不误导为网站登录密码', async (provider) => {
  setup('en');
  fireEvent.click(await screen.findByRole('button', { name: provider.label }));
  expect(screen.getByLabelText('App password')).toHaveAttribute('type', 'password');
  expect(screen.getByText(/not.*sign-in password/)).toBeVisible();
});
