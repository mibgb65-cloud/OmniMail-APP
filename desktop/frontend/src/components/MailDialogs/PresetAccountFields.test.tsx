import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
import * as api from '../../lib/bridge/mail';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { AccountDialog } from './AccountDialog';

vi.mock('../../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/mail')>()),
  providers: vi.fn(),
  addAccount: vi.fn(),
}));

const providers = [
  ['gmail', 'Gmail'],
  ['qq', 'QQ 邮箱'],
  ['netease_163', '网易邮箱'],
  ['netease_126', '网易邮箱'],
] as const;
const presets: api.ProviderPreset[] = [...providers.map(([code]) => code), 'custom'].map(
  (code) => ({
    code,
    name: code,
    authKinds: [api.AuthKind.AuthPassword],
    endpoints: [
      {
        protocol: Protocol.ProtocolIMAP,
        host: code === 'custom' ? '' : `imap.${code.replaceAll('_', '-')}.example.invalid`,
        port: 993,
        tlsMode: api.TLSMode.TLSImplicit,
      },
      {
        protocol: Protocol.ProtocolSMTP,
        host: code === 'custom' ? '' : `smtp.${code.replaceAll('_', '-')}.example.invalid`,
        port: 587,
        tlsMode: api.TLSMode.TLSStartTLS,
      },
    ],
  }),
);

function renderAccount(locale: 'zh-CN' | 'en' = 'zh-CN') {
  return render(
    <I18nProvider initialLocale={locale}>
      <AccountDialog onClose={vi.fn()} onSaved={vi.fn()} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(api.providers).mockResolvedValue(presets);
  vi.mocked(api.addAccount).mockReturnValue(new Promise(() => {}));
});

describe('预设账号简洁登录', () => {
  it.each(providers)(
    '%s 隐藏协议表单，提交仍携带 Providers 返回的端点和同一套邮箱凭据',
    async (code, label) => {
      renderAccount();
      fireEvent.click(await screen.findByRole('button', { name: label }));
      expect(screen.queryByRole('group', { name: 'IMAP' })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'SMTP' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('登录用户名')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      const domain = code.replaceAll('_', '-');
      const emailDomain =
        code === 'netease_163'
          ? '163.com'
          : code === 'netease_126'
            ? '126.com'
            : `${domain}.example.invalid`;
      const email = `person@${emailDomain}`;
      fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: email } });
      fireEvent.change(
        screen.getByLabelText(code === 'gmail' ? '应用专用密码' : '密码 / 应用授权码'),
        {
          target: { value: 'test-only-preset-code' },
        },
      );
      fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
      expect(api.addAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          providerCode: code,
          email,
          imap: expect.objectContaining({
            host: `imap.${domain}.example.invalid`,
            port: 993,
            tlsMode: api.TLSMode.TLSImplicit,
            username: email,
            password: 'test-only-preset-code',
            authKind: api.AuthKind.AuthPassword,
          }),
          smtp: expect.objectContaining({
            host: `smtp.${domain}.example.invalid`,
            port: 587,
            tlsMode: api.TLSMode.TLSStartTLS,
            username: email,
            password: 'test-only-preset-code',
            authKind: api.AuthKind.AuthPassword,
          }),
        }),
        expect.any(AbortSignal),
      );
    },
  );

  it('Gmail 英语界面明确使用 App password，不显示 OAuth 注册要求或服务器控件', async () => {
    renderAccount('en');
    fireEvent.click(await screen.findByRole('button', { name: 'Gmail' }));
    expect(screen.getByLabelText('App password')).toHaveAttribute('type', 'password');
    expect(screen.getByText(/not your Google sign-in password/)).toBeVisible();
    expect(screen.queryByText(/registered client|OAuth/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('自定义独立 SMTP 凭据不能影响随后选择的预设邮箱', async () => {
    renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: '自定义 IMAP/SMTP' }));
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'old@example.invalid' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    const outgoing = within(screen.getByRole('group', { name: 'SMTP' }));
    fireEvent.change(outgoing.getByLabelText('登录用户名'), { target: { value: 'old-smtp-user' } });
    fireEvent.change(outgoing.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'old-smtp-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: '返回选择服务商' }));
    fireEvent.click(screen.getByRole('button', { name: 'QQ 邮箱' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'person@qq.com' } });
    fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'new-preset-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    expect(api.addAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        imap: expect.objectContaining({ username: 'person@qq.com', password: 'new-preset-secret' }),
        smtp: expect.objectContaining({ username: 'person@qq.com', password: 'new-preset-secret' }),
      }),
      expect.any(AbortSignal),
    );
    expect(JSON.stringify(vi.mocked(api.addAccount).mock.calls[0]?.[0])).not.toContain('old-smtp');
  });

  it('只有一个选中背景指示器，推进和返回复用同一 DOM，不混入进度列表语义', async () => {
    renderAccount();
    const progress = screen.getByRole('complementary', { name: '添加进度' });
    const marker = progress.querySelector('[data-step-indicator]');
    expect(marker).not.toBeNull();
    expect(marker).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(await screen.findByRole('button', { name: 'QQ 邮箱' }));
    expect(progress.querySelector('[data-step-indicator]')).toBe(marker);
    fireEvent.click(screen.getByRole('button', { name: '返回选择服务商' }));
    expect(progress.querySelectorAll('[data-step-indicator]')).toHaveLength(1);
    expect(progress.querySelector('[data-step-indicator]')).toBe(marker);
    expect(within(progress).getAllByRole('listitem')).toHaveLength(4);
  });
});
