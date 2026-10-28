import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const presets: api.ProviderPreset[] = ['gmail', 'qq', 'netease_163', 'netease_126', 'custom'].map(
  (code) => ({
    code,
    name: code,
    authKinds: [api.AuthKind.AuthPassword],
    endpoints: [
      {
        protocol: Protocol.ProtocolIMAP,
        host: code === 'custom' ? '' : `imap.${code}.example.invalid`,
        port: 993,
        tlsMode: api.TLSMode.TLSImplicit,
      },
      {
        protocol: Protocol.ProtocolSMTP,
        host: code === 'custom' ? '' : `smtp.${code}.example.invalid`,
        port: 465,
        tlsMode: api.TLSMode.TLSImplicit,
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
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(api.providers).mockResolvedValue(presets);
});

describe('添加账号服务商选择流程', () => {
  it('首先显示预设/自定义卡片，不显示账号表单，也不自动验证', async () => {
    renderAccount();
    const presetsRegion = await screen.findByRole('region', { name: '预设服务商' });
    for (const name of ['Gmail', 'QQ 邮箱', '网易 163', '网易 126']) {
      expect(within(presetsRegion).getByRole('button', { name })).toBeEnabled();
    }
    expect(
      within(presetsRegion).getByRole('button', { name: 'Gmail' }),
    ).toHaveAccessibleDescription(/OAuth 尚未配置/);
    const custom = screen.getByRole('region', { name: '自定义服务商' });
    expect(within(custom).getByRole('button', { name: '自定义 IMAP/SMTP' })).toBeEnabled();
    expect(screen.queryByLabelText('邮箱地址')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '验证并添加' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '选择邮箱服务商' })).toHaveFocus();
    expect(api.addAccount).not.toHaveBeenCalled();
  });

  it('选择预设后进入对应配置，预填服务器并将焦点移到邮箱', async () => {
    renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'QQ 邮箱' }));
    expect(screen.getByRole('heading', { name: '配置 QQ 邮箱' })).toBeVisible();
    expect(screen.getByLabelText('邮箱地址')).toHaveFocus();
    expect(
      within(screen.getByRole('group', { name: 'IMAP' })).getByLabelText('服务器'),
    ).toHaveValue('imap.qq.example.invalid');
    expect(
      within(screen.getByRole('group', { name: 'SMTP' })).getByLabelText('服务器'),
    ).toHaveValue('smtp.qq.example.invalid');
    expect(screen.queryByRole('region', { name: '预设服务商' })).not.toBeInTheDocument();
    expect(api.addAccount).not.toHaveBeenCalled();
  });

  it('自定义入口进入可手动填写的独立服务器配置', async () => {
    renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: '自定义 IMAP/SMTP' }));
    expect(screen.getByRole('heading', { name: '配置 自定义 IMAP/SMTP' })).toBeVisible();
    for (const protocol of ['IMAP', 'SMTP']) {
      expect(
        within(screen.getByRole('group', { name: protocol })).getByLabelText('服务器'),
      ).toHaveValue('');
    }
    expect(screen.getByRole('button', { name: '验证并添加' })).toBeEnabled();
  });

  it('返回选择页后清除旧密码，保留本轮邮箱信息且不写浏览器存储', async () => {
    renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'QQ 邮箱' }));
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('账号名称'), { target: { value: '工作邮箱' } });
    fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'test-only-secret' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    const outgoing = within(screen.getByRole('group', { name: 'SMTP' }));
    fireEvent.change(outgoing.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'test-only-smtp-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: '返回选择服务商' }));
    expect(screen.getByRole('heading', { name: '选择邮箱服务商' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '自定义 IMAP/SMTP' }));
    expect(screen.getByLabelText('邮箱地址')).toHaveValue('person@example.invalid');
    expect(screen.getByLabelText('账号名称')).toHaveValue('工作邮箱');
    for (const password of screen.getAllByLabelText('密码 / 应用授权码')) {
      expect(password).toHaveValue('');
    }
    expect(api.providers).toHaveBeenCalledOnce();
    expect(localStorage.length).toBe(0);
  });

  it('加载时不开放配置，加载失败显示安全错误并允许重试', async () => {
    let reject: (reason: Error) => void = () => {};
    vi.mocked(api.providers).mockReturnValueOnce(
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    renderAccount();
    expect(screen.getByRole('status')).toHaveTextContent('正在加载服务商');
    expect(screen.queryByLabelText('邮箱地址')).not.toBeInTheDocument();
    await act(async () => reject(new Error('NETWORK_FAILED token=private-test-token')));
    expect(await screen.findByRole('alert')).toHaveTextContent('无法连接邮件服务器');
    expect(screen.queryByText(/private-test-token/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载服务商' }));
    expect(screen.getByRole('heading', { name: '选择邮箱服务商' })).toHaveFocus();
    expect(await screen.findByRole('button', { name: 'QQ 邮箱' })).toBeEnabled();
    expect(api.providers).toHaveBeenCalledTimes(2);
  });

  it('服务商列表为空时提供重试，不凭空构造可用服务商', async () => {
    vi.mocked(api.providers).mockResolvedValueOnce([]);
    renderAccount();
    expect(await screen.findByText('暂无可用服务商，请重新加载。')).toBeVisible();
    expect(screen.queryByRole('button', { name: '自定义 IMAP/SMTP' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载服务商' }));
    expect(await screen.findByRole('button', { name: '自定义 IMAP/SMTP' })).toBeEnabled();
  });

  it('英语界面提供相同选择流程，Gmail 不伪装成可用 OAuth 授权', async () => {
    renderAccount('en');
    expect(await screen.findByRole('region', { name: 'Preset providers' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Custom IMAP/SMTP' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Gmail' }));
    expect(screen.getByRole('heading', { name: 'Set up Gmail' })).toBeVisible();
    expect(screen.getByText(/Gmail OAuth/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /OAuth|Authorize/ })).not.toBeInTheDocument();
  });

  it('关闭选择页取消服务商加载请求', () => {
    vi.mocked(api.providers).mockReturnValue(new Promise(() => {}));
    const view = renderAccount();
    const signal = vi.mocked(api.providers).mock.calls[0]?.[0];
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('验证时禁止返回或重复提交，并保留请求取消行为', async () => {
    vi.mocked(api.addAccount).mockReturnValue(new Promise(() => {}));
    const view = renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'QQ 邮箱' }));
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'test-only-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    expect(screen.getByRole('button', { name: '返回选择服务商' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '验证并添加' })).toBeDisabled();
    const form = screen.getByLabelText('邮箱地址').closest('form');
    expect(form).not.toBeNull();
    if (form) fireEvent.submit(form);
    expect(api.addAccount).toHaveBeenCalledOnce();
    const signal = vi.mocked(api.addAccount).mock.calls[0]?.[1];
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(api.providers).toHaveBeenCalledOnce());
  });
});
