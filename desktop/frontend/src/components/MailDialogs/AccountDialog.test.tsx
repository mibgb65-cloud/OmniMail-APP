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
  it.each([
    [
      'zh-CN',
      '输入邮箱自动识别服务商，或从下方直接选择。',
      '输入完整邮箱地址后，自动匹配服务商。',
      'QQ 邮箱',
      '填写邮箱地址和密码或应用授权码，服务器信息已预设。',
    ],
    [
      'en',
      'Enter your email to detect its provider, or choose one below.',
      'Enter a complete email address to detect its provider.',
      'QQ Mail',
      'Enter your email and password or app password. Server settings are already preset.',
    ],
  ] as const)(
    '%s 选择页去掉重复说明，保留识别状态和配置说明',
    async (locale, removed, hint, provider, setup) => {
      renderAccount(locale);
      await screen.findByRole('button', { name: provider });
      expect(screen.queryByText(removed)).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(hint);
      fireEvent.click(screen.getByRole('button', { name: provider }));
      expect(screen.getByText(setup)).toBeVisible();
    },
  );

  it('左侧仅显示添加进度，右侧表单显示当前选项，不提供跳过步骤的入口', async () => {
    renderAccount();
    await screen.findByRole('region', { name: '预设服务商' });
    const progress = screen.getByRole('complementary', { name: '添加进度' });
    const steps = within(progress).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(within(progress).getByText('验证连接')).toBeVisible();
    expect(within(progress).getByText('同步邮件')).toBeVisible();
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    expect(steps[1]).toHaveAttribute('data-state', 'upcoming');
    expect(within(progress).queryByRole('button')).not.toBeInTheDocument();
    expect(within(progress).queryByLabelText('邮箱地址')).not.toBeInTheDocument();
    const panel = screen.getByRole('form', { name: '选择邮箱服务商' });
    expect(within(panel).getByLabelText('邮箱地址')).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'QQ 邮箱' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: '关闭' })).toBeVisible();
  });

  it('进入配置后左侧标明已选服务商，返回后进度复原且清除秘密', async () => {
    renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'QQ 邮箱' }));
    const progress = screen.getByRole('complementary', { name: '添加进度' });
    let steps = within(progress).getAllByRole('listitem');
    const completed = steps[0];
    if (!completed) throw new Error('未找到服务商选择步骤');
    expect(completed).toHaveAttribute('data-state', 'complete');
    expect(within(completed).getByText('已选择：QQ 邮箱')).toBeVisible();
    expect(completed.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('form', { name: '配置 QQ 邮箱' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('密码 / 应用授权码'), {
      target: { value: 'test-only-split-layout-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: '返回选择服务商' }));
    steps = within(progress).getAllByRole('listitem');
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    expect(steps[1]).toHaveAttribute('data-state', 'upcoming');
    expect(within(progress).queryByText('已选择：QQ 邮箱')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'QQ 邮箱' }));
    expect(screen.getByLabelText('密码 / 应用授权码')).toHaveValue('');
    expect(api.addAccount).not.toHaveBeenCalled();
  });

  it('英语进度与右侧配置保持一致，不将选择服务商描述为账号已添加', async () => {
    renderAccount('en');
    fireEvent.click(await screen.findByRole('button', { name: 'Gmail' }));
    const progress = screen.getByRole('complementary', { name: 'Setup progress' });
    expect(within(progress).getByText('Selected: Gmail')).toBeVisible();
    expect(within(progress).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('form', { name: 'Set up Gmail' })).toBeVisible();
    expect(api.addAccount).not.toHaveBeenCalled();
  });

  it('首先显示邮箱快捷输入和预设/自定义卡片，不显示服务器表单，也不自动验证', async () => {
    renderAccount();
    const presetsRegion = await screen.findByRole('region', { name: '预设服务商' });
    for (const name of ['Gmail', 'QQ 邮箱', '网易 163', '网易 126']) {
      expect(within(presetsRegion).getByRole('button', { name })).toBeEnabled();
    }
    expect(
      within(presetsRegion).getByRole('button', { name: 'Gmail' }),
    ).toHaveAccessibleDescription(/应用专用密码登录/);
    const custom = screen.getByRole('region', { name: '自定义服务商' });
    expect(within(custom).getByRole('button', { name: '自定义 IMAP/SMTP' })).toBeEnabled();
    expect(screen.getByLabelText('邮箱地址')).toBeVisible();
    expect(screen.queryByRole('group', { name: 'IMAP' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '验证并添加' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '选择邮箱服务商' })).toHaveFocus();
    expect(api.addAccount).not.toHaveBeenCalled();
  });

  it.each([
    ['person@gmail.com', 'Gmail'],
    ['person@QQ.COM', 'QQ 邮箱'],
    ['person@163.com', '网易 163'],
    ['person@126.com', '网易 126'],
  ])('输入 %s 后识别 %s，继续时带入邮箱并隐藏服务器', async (email, label) => {
    renderAccount();
    await screen.findByRole('region', { name: '预设服务商' });
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: email } });
    expect(screen.getByRole('status')).toHaveTextContent(`已识别：${label}`);
    expect(screen.getByRole('heading', { name: '选择邮箱服务商' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(screen.getByRole('heading', { name: `配置 ${label}` })).toBeVisible();
    expect(screen.getByLabelText('邮箱地址')).toHaveValue(email);
    expect(screen.queryByRole('group', { name: 'IMAP' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'SMTP' })).not.toBeInTheDocument();
    expect(api.addAccount).not.toHaveBeenCalled();
  });

  it.each(['person@example.invalid', 'person@gmail.com.evil.invalid', 'person@sub.qq.com'])(
    '未知或相似域名 %s 进入自定义配置，不猜测服务器',
    async (email) => {
      renderAccount();
      await screen.findByRole('button', { name: 'Gmail' });
      fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: email } });
      expect(screen.getByRole('status')).toHaveTextContent('将使用自定义 IMAP/SMTP');
      fireEvent.click(screen.getByRole('button', { name: '继续' }));
      expect(screen.getByRole('heading', { name: '配置 自定义 IMAP/SMTP' })).toBeVisible();
      expect(screen.getByLabelText('邮箱地址')).toHaveValue(email);
      expect(
        within(screen.getByRole('group', { name: 'IMAP' })).getByLabelText('服务器'),
      ).toHaveValue('');
    },
  );

  it.each([
    '',
    'person',
    'person@',
    'person@@qq.com',
    '.person@qq.com',
    `${'a'.repeat(255)}@qq.com`,
  ])('无效邮箱不能通过快捷入口：%s', async (email) => {
    renderAccount();
    await screen.findByRole('button', { name: 'Gmail' });
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: email } });
    expect(screen.getByRole('button', { name: '继续' })).toBeDisabled();
    const form = screen.getByLabelText('邮箱地址').closest('form');
    if (form) fireEvent.submit(form);
    expect(screen.getByRole('heading', { name: '选择邮箱服务商' })).toBeVisible();
    expect(api.addAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'QQ 邮箱' }));
    expect(screen.getByRole('heading', { name: '配置 QQ 邮箱' })).toBeVisible();
  });

  it('使用 Enter 对应的表单提交继续，返回后可修改地址重新识别', async () => {
    renderAccount();
    await screen.findByRole('button', { name: 'Gmail' });
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'person+work@gmail.com' },
    });
    const form = screen.getByLabelText('邮箱地址').closest('form');
    if (form) fireEvent.submit(form);
    expect(screen.getByRole('heading', { name: '配置 Gmail' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('应用专用密码'), {
      target: { value: 'test-only-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: '返回选择服务商' }));
    expect(screen.getByLabelText('邮箱地址')).toHaveValue('person+work@gmail.com');
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(screen.getByLabelText('密码 / 应用授权码')).toHaveValue('');
    expect(storage).not.toHaveBeenCalled();
  });

  it('不显示指定的密码存储提示，服务商图标为本地资源且不重复朗读品牌名', async () => {
    renderAccount();
    await screen.findByRole('button', { name: 'Gmail' });
    expect(screen.queryByText(/密码只用于认证并保存到系统凭据存储/)).not.toBeInTheDocument();
    for (const name of ['Gmail', 'QQ 邮箱', '网易 163', '网易 126']) {
      const image = screen.getByRole('button', { name }).querySelector('img');
      expect(image).toHaveAttribute('alt', '');
      expect(image?.getAttribute('src')).toMatch(/^\/providers\/[\w-]+\.(?:ico|png)$/);
    }
  });

  it('匹配只使用实际已加载的服务商，缺失自定义时禁用未知域名入口', async () => {
    vi.mocked(api.providers).mockResolvedValueOnce(
      presets.filter((preset) => preset.code === 'qq'),
    );
    renderAccount();
    await screen.findByRole('button', { name: 'QQ 邮箱' });
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'person@gmail.com' },
    });
    expect(screen.getByRole('button', { name: '继续' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('暂无可用配置');
  });

  it('英语快捷入口识别服务商并进入配置，不显示已移除的提示', async () => {
    renderAccount('en');
    await screen.findByRole('button', { name: 'Gmail' });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'person@gmail.com' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Detected: Gmail');
    expect(screen.queryByText(/Passwords are used for authentication/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Set up Gmail' })).toBeVisible();
  });

  it('选择预设后进入简洁登录，将焦点移到邮箱但不展示协议配置', async () => {
    renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'QQ 邮箱' }));
    expect(screen.getByRole('heading', { name: '配置 QQ 邮箱' })).toBeVisible();
    expect(screen.getByLabelText('邮箱地址')).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'IMAP' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'SMTP' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('密码 / 应用授权码')).toBeVisible();
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
    expect(screen.getByText('填写账号与登录凭据，确认服务器信息后验证并添加。')).toBeVisible();
  });

  it('返回选择页后清除旧密码，保留本轮邮箱信息且不写浏览器存储', async () => {
    renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: '自定义 IMAP/SMTP' }));
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

  it('英语界面 Gmail 使用应用专用密码，不提供 OAuth 授权入口', async () => {
    renderAccount('en');
    expect(await screen.findByRole('region', { name: 'Preset providers' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Custom IMAP/SMTP' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Gmail' }));
    expect(screen.getByRole('heading', { name: 'Set up Gmail' })).toBeVisible();
    expect(screen.getByLabelText('App password')).toBeVisible();
    expect(screen.getByText(/not your Google sign-in password/)).toBeVisible();
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
