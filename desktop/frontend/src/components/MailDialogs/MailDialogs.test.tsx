import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import * as api from '../../lib/bridge/mail';
import { AccountStatus, Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
import { AccountDialog } from './AccountDialog';
import { ComposeDialog } from './ComposeDialog';

vi.mock('../../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/mail')>()),
  providers: vi.fn(),
  addAccount: vi.fn(),
  send: vi.fn(),
}));

const account: api.AccountSummary = {
  id: 'test-id',
  providerCode: 'custom',
  email: 'person@example.invalid',
  displayName: '测试',
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
};
const presets: api.ProviderPreset[] = ['custom', 'qq'].map((code) => ({
  code,
  name: code === 'custom' ? '自定义' : 'QQ',
  authKinds: [api.AuthKind.AuthPassword],
  endpoints: [
    {
      protocol: Protocol.ProtocolIMAP,
      host: code === 'custom' ? '' : 'imap.qq.com',
      port: 993,
      tlsMode: api.TLSMode.TLSImplicit,
    },
    {
      protocol: Protocol.ProtocolSMTP,
      host: code === 'custom' ? '' : 'smtp.qq.com',
      port: 465,
      tlsMode: api.TLSMode.TLSImplicit,
    },
  ],
}));

describe('邮件账号和撰写弹窗', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.providers).mockResolvedValue(presets);
    vi.mocked(api.addAccount).mockResolvedValue(account);
  });

  it('使用预设验证并提交，默认收发信共享凭据且不写浏览器存储', async () => {
    const saved = vi.fn();
    const close = vi.fn();
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <I18nProvider initialLocale="zh-CN">
        <AccountDialog onClose={close} onSaved={saved} />
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'QQ 邮箱' }));
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: account.email } });
    fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'test-only-app-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(api.addAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: account.email,
        providerCode: 'qq',
        imap: expect.objectContaining({
          host: 'imap.qq.com',
          username: account.email,
          password: 'test-only-app-code',
        }),
        smtp: expect.objectContaining({
          host: 'smtp.qq.com',
          username: account.email,
          password: 'test-only-app-code',
        }),
      }),
      expect.any(AbortSignal),
    );
    expect(close).toHaveBeenCalledOnce();
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });

  it('切换服务商会清除旧秘密，认证失败显示安全错误且保留表单', async () => {
    const close = vi.fn();
    vi.mocked(api.addAccount).mockRejectedValue(new Error('AUTH_INVALID'));
    render(
      <I18nProvider initialLocale="zh-CN">
        <AccountDialog onClose={close} onSaved={vi.fn()} />
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '自定义 IMAP/SMTP' }));
    fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'old-test-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '返回选择服务商' }));
    fireEvent.click(screen.getByRole('button', { name: 'QQ 邮箱' }));
    expect(screen.getByLabelText('密码 / 应用授权码')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: account.email } });
    fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'new-test-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('服务器拒绝登录');
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('邮箱地址')).toHaveValue(account.email);
  });

  it('自定义 SMTP 可使用另一套用户名和密码', async () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <AccountDialog onClose={vi.fn()} onSaved={vi.fn()} />
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '自定义 IMAP/SMTP' }));
    fireEvent.click(screen.getByRole('checkbox'));
    const outgoing = within(screen.getByRole('group', { name: 'SMTP' }));
    expect(outgoing.getByLabelText('登录用户名')).toBeVisible();
    expect(screen.getAllByLabelText('密码 / 应用授权码')).toHaveLength(2);
  });

  it('SMTP 结果不确定时保留文案并禁止原弹窗直接重发', async () => {
    vi.mocked(api.send).mockRejectedValue(new Error('SEND_UNCERTAIN'));
    render(
      <I18nProvider initialLocale="zh-CN">
        <ComposeDialog
          accounts={[account]}
          selectedAccount={account.id}
          onClose={vi.fn()}
          onSent={vi.fn()}
        />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('收件人'), {
      target: { value: 'recipient@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('勿直接重复发送');
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
    expect(api.send).toHaveBeenCalledOnce();
  });
});
