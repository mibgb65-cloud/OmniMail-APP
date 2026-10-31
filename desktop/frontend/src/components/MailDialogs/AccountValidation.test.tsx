import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
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
async function setup(provider = 'Gmail') {
  render(
    <I18nProvider initialLocale="zh-CN">
      <AccountDialog onClose={vi.fn()} onSaved={vi.fn()} />
    </I18nProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: provider }));
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(api.providers).mockResolvedValue(presets);
  vi.mocked(api.addAccount).mockReturnValue(new Promise(() => {}));
});

it('必填错误以内联呈现，关闭自动气泡但保留校验和首错焦点', async () => {
  await setup();
  const field = screen.getByLabelText('邮箱地址');
  const password = screen.getByLabelText('应用专用密码');
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  expect(field.closest('form')).toHaveAttribute('novalidate');
  expect(field).toHaveAttribute('required');
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(field).toHaveAccessibleDescription(/请填写此项/);
  expect(password).toHaveAccessibleDescription(/请填写此项/);
  expect(field).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('请完善以下 2 项信息');
  expect(screen.getByRole('link', { name: '账号 1 · 邮箱地址' })).toHaveAttribute(
    'href',
    `#${field.id}`,
  );
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('修正输入实时清理错误，字段名称不混入错误提示，合法提交仍正常', async () => {
  await setup();
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  const email = screen.getByLabelText('邮箱地址');
  fireEvent.change(email, { target: { value: 'invalid-email' } });
  expect(email).toHaveAccessibleDescription(/请输入有效的邮箱地址/);
  fireEvent.change(email, { target: { value: 'person@gmail.com' } });
  expect(email).not.toHaveAttribute('aria-invalid');
  fireEvent.change(screen.getByLabelText('应用专用密码'), { target: { value: 'test-only-code' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  expect(api.addAccount).toHaveBeenCalledOnce();
});

it('删除未填写的批量账号后清理关联错误，不遗留原生气泡或失效链接', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'one@gmail.com' } });
  fireEvent.change(screen.getByLabelText('应用专用密码'), { target: { value: 'test-only-one' } });
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  expect(second.getByLabelText('邮箱地址')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('link', { name: '账号 2 · 邮箱地址' })).toBeVisible();
  expect(api.addAccount).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '移除账号 2' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.queryByRole('link', { name: /账号 2/ })).not.toBeInTheDocument();
});

it('自定义端口范围仍受校验，错误与控件关联且不展示浏览器原始文案', async () => {
  await setup('自定义 IMAP/SMTP');
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'one@example.invalid' } });
  const incoming = within(screen.getByRole('group', { name: 'IMAP' }));
  const outgoing = within(screen.getByRole('group', { name: 'SMTP' }));
  fireEvent.change(incoming.getByLabelText('服务器'), {
    target: { value: 'imap.example.invalid' },
  });
  fireEvent.change(outgoing.getByLabelText('服务器'), {
    target: { value: 'smtp.example.invalid' },
  });
  fireEvent.change(incoming.getByLabelText('密码 / 应用授权码'), {
    target: { value: 'test-only-code' },
  });
  const port = incoming.getByLabelText('端口');
  fireEvent.change(port, { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  expect(port).toHaveAccessibleDescription(/1.*65535/);
  expect(port).toHaveFocus();
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('账号行重排后错误摘要使用新的账号编号，不遗留旧行链接', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'one@gmail.com' } });
  fireEvent.change(screen.getByLabelText('应用专用密码'), { target: { value: 'test-one' } });
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  fireEvent.change(second.getByLabelText('邮箱地址'), { target: { value: 'two@gmail.com' } });
  fireEvent.change(second.getByLabelText('应用专用密码'), { target: { value: 'test-two' } });
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 3 个账号' }));
  expect(screen.getByRole('link', { name: '账号 3 · 邮箱地址' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '移除账号 2' }));
  await waitFor(() =>
    expect(screen.getByRole('link', { name: '账号 2 · 邮箱地址' })).toBeVisible(),
  );
  expect(screen.queryByRole('link', { name: /账号 3/ })).not.toBeInTheDocument();
});

it('保留邮箱识别描述，切换到配置后清理旧输入的校验错误', async () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <AccountDialog onClose={vi.fn()} onSaved={vi.fn()} />
    </I18nProvider>,
  );
  await screen.findByRole('button', { name: 'Gmail' });
  const email = screen.getByLabelText('邮箱地址');
  fireEvent.submit(screen.getByRole('form', { name: '选择邮箱服务商' }));
  expect(email).toHaveAccessibleDescription(/输入完整邮箱地址后.*请填写此项/);
  fireEvent.click(screen.getByRole('button', { name: 'Gmail' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByLabelText('邮箱地址')).not.toHaveAttribute('aria-invalid');
});

it('程序设置的超长密码也被阻止，提示不包含原始秘密', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'one@gmail.com' } });
  const secret = 'test-private-marker'.repeat(80);
  const password = screen.getByLabelText('应用专用密码');
  fireEvent.change(password, { target: { value: secret } });
  fireEvent.submit(screen.getByRole('form', { name: '配置 Gmail' }));
  expect(password).toHaveAccessibleDescription(/1024/);
  expect(screen.getByRole('alert')).not.toHaveTextContent('test-private-marker');
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('单处错误只显示字段下方提示，不重复展示顶部摘要', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'one@gmail.com' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加' }));
  expect(screen.queryByText('请完善以下 1 项信息')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('请填写此项。');
  expect(screen.getByLabelText('应用专用密码')).toHaveFocus();
  expect(api.addAccount).not.toHaveBeenCalled();
});
