import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountStatus, Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
import * as api from '../../lib/bridge/mail';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { AccountDialog } from './AccountDialog';

vi.mock('../../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/mail')>()),
  providers: vi.fn(),
  addAccount: vi.fn(),
  accounts: vi.fn(),
  synchronize: vi.fn(),
}));

const account: api.AccountSummary = {
  id: 'test-created-account',
  email: 'person@qq.com',
  providerCode: 'qq',
  displayName: '测试邮箱',
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
};
const presets: api.ProviderPreset[] = [
  {
    code: 'qq',
    name: 'QQ',
    authKinds: [api.AuthKind.AuthPassword],
    endpoints: [
      {
        protocol: Protocol.ProtocolIMAP,
        host: 'imap.qq.example.invalid',
        port: 993,
        tlsMode: api.TLSMode.TLSImplicit,
      },
      {
        protocol: Protocol.ProtocolSMTP,
        host: 'smtp.qq.example.invalid',
        port: 465,
        tlsMode: api.TLSMode.TLSImplicit,
      },
    ],
  },
];

async function setup(locale: 'zh-CN' | 'en' = 'zh-CN') {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = render(
    <I18nProvider initialLocale={locale}>
      <AccountDialog onClose={onClose} onSaved={onSaved} />
    </I18nProvider>,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: locale === 'en' ? 'QQ Mail' : 'QQ 邮箱' }),
  );
  fireEvent.change(screen.getByLabelText(locale === 'en' ? 'Email address' : '邮箱地址'), {
    target: { value: account.email },
  });
  fireEvent.change(
    screen.getByLabelText(locale === 'en' ? 'Password / app password' : '密码 / 应用授权码'),
    {
      target: { value: 'test-only-account-code' },
    },
  );
  return { ...view, onClose, onSaved };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(api.providers).mockResolvedValue(presets);
});

describe('账号四步进度', () => {
  it('第三步对应真实待完成请求，禁止重复提交，失败后回到配置且显示安全错误', async () => {
    let reject: (reason: Error) => void = () => {};
    vi.mocked(api.addAccount).mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const { onClose, onSaved } = await setup();
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    const progress = screen.getByRole('complementary', { name: '添加进度' });
    expect(within(progress).getAllByRole('listitem')[2]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('heading', { name: '验证连接' })).toHaveFocus();
    expect(screen.getByRole('button', { name: '返回选择服务商' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: '验证连接' }));
    expect(api.addAccount).toHaveBeenCalledOnce();
    await act(async () => reject(new Error('AUTH_INVALID private-test-marker')));
    expect(within(progress).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
    expect(await screen.findByRole('alert')).toHaveFocus();
    expect(screen.queryByText(/private-test-marker/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('邮箱地址')).toHaveValue(account.email);
    expect(screen.getByLabelText('密码 / 应用授权码')).toHaveValue('test-only-account-code');
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('成功后进入后台同步阶段，不再创建/同步第二次，完成按钮才关闭窗口', async () => {
    let resolve: (value: api.AccountSummary) => void = () => {};
    vi.mocked(api.addAccount).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { onClose, onSaved } = await setup();
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    await act(async () => resolve(account));
    const progress = screen.getByRole('complementary', { name: '添加进度' });
    expect(within(progress).getAllByRole('listitem')).toHaveLength(4);
    expect(progress.querySelectorAll('[data-state="complete"]')).toHaveLength(3);
    expect(within(progress).getAllByRole('listitem')[3]).toHaveAttribute('aria-current', 'step');
    expect(within(progress).getAllByRole('listitem')[3]).toHaveAttribute('data-state', 'current');
    expect(within(progress).getAllByText('已选择：QQ 邮箱')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '同步邮件' })).toHaveFocus();
    expect(screen.getByText('账号已添加')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('首次邮件同步已安排在后台进行');
    expect(screen.queryByLabelText('密码 / 应用授权码')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '返回选择服务商' })).not.toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole('form', { name: '同步邮件' }));
    expect(api.addAccount).toHaveBeenCalledOnce();
    expect(api.synchronize).not.toHaveBeenCalled();
    expect(api.accounts).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('同步安排失败不会伪装账号添加失败，也不暴露原始错误或重复创建', async () => {
    vi.mocked(api.addAccount).mockResolvedValue({
      ...account,
      sync: { ...account.sync, errorCode: 'NETWORK_FAILED private-sync-marker' },
    });
    const { onSaved, onClose } = await setup();
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    expect(await screen.findByRole('heading', { name: '同步邮件' })).toBeVisible();
    expect(screen.getByText('账号已添加')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('无法连接邮件服务器');
    expect(screen.getByText(/首次同步未能启动/)).toBeVisible();
    expect(screen.queryByText(/private-sync-marker/)).not.toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(api.addAccount).toHaveBeenCalledOnce();
  });

  it('同步排队返回 BUSY 表示已有任务，不显示首次同步启动失败', async () => {
    vi.mocked(api.addAccount).mockResolvedValue({
      ...account,
      sync: { ...account.sync, errorCode: 'BUSY' },
    });
    await setup();
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    expect(await screen.findByRole('heading', { name: '同步邮件' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('首次邮件同步已安排在后台进行');
    expect(api.synchronize).not.toHaveBeenCalled();
  });

  it('验证过程中关闭会取消请求，晚到成功不能触发保存回调或进入第四步', async () => {
    let resolve: (value: api.AccountSummary) => void = () => {};
    vi.mocked(api.addAccount).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = await setup();
    fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
    const signal = vi.mocked(api.addAccount).mock.calls[0]?.[1];
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve(account));
    expect(view.onSaved).not.toHaveBeenCalled();
    expect(view.onClose).not.toHaveBeenCalled();
  });

  it('英语四步与后台同步说明一致', async () => {
    vi.mocked(api.addAccount).mockResolvedValue(account);
    const { onClose } = await setup('en');
    fireEvent.click(screen.getByRole('button', { name: 'Verify and add' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sync mail' })).toBeVisible());
    expect(screen.getByRole('status')).toHaveTextContent('scheduled in the background');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
