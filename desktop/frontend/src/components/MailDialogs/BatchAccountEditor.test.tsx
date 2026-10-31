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
const presets: api.ProviderPreset[] = [
  {
    code: 'gmail',
    name: 'Gmail',
    authKinds: [api.AuthKind.AuthPassword],
    endpoints: [
      {
        protocol: Protocol.ProtocolIMAP,
        host: 'imap.gmail.com',
        port: 993,
        tlsMode: api.TLSMode.TLSImplicit,
      },
      {
        protocol: Protocol.ProtocolSMTP,
        host: 'smtp.gmail.com',
        port: 465,
        tlsMode: api.TLSMode.TLSImplicit,
      },
    ],
  },
];
async function setup(fillFirst = true, batch = true) {
  render(
    <I18nProvider initialLocale="zh-CN">
      <AccountDialog onClose={vi.fn()} onSaved={vi.fn()} />
    </I18nProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Gmail' }));
  if (fillFirst) {
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'one@gmail.com' } });
    fireEvent.change(screen.getByLabelText('应用专用密码'), {
      target: { value: 'test-first-code' },
    });
  }
  if (batch) fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(api.providers).mockResolvedValue(presets);
  vi.mocked(api.addAccount).mockReturnValue(new Promise(() => {}));
});

it('首个账号就使用编辑卡片，新增后折成摘要，删除新项后仍保持同一卡片', async () => {
  await setup(true, false);
  const first = within(screen.getByRole('group', { name: '账号 1' }));
  expect(first.getByText('当前编辑 · 账号 1')).toBeVisible();
  expect(first.getByLabelText('邮箱地址')).toBeVisible();
  expect(screen.getByText('待验证 1 个账号')).toBeVisible();
  expect(screen.queryByRole('button', { name: '移除账号 1' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  expect(first.getByLabelText('邮箱地址')).not.toBeVisible();
  expect(screen.getByRole('button', { name: '编辑账号 1' })).toHaveTextContent('one@gmail.com');
  expect(screen.getByText('当前编辑 · 账号 2')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '移除账号 2' }));
  expect(first.getByText('当前编辑 · 账号 1')).toBeVisible();
  expect(first.getByLabelText('邮箱地址')).toHaveValue('one@gmail.com');
  expect(first.getByLabelText('应用专用密码')).toHaveValue('test-first-code');
  expect(first.getByLabelText('邮箱地址')).toHaveFocus();
  expect(screen.queryByRole('button', { name: '移除账号 1' })).not.toBeInTheDocument();
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('其他账号为摘要，仅新账号展开，点击摘要可切换且凭据不丢失', async () => {
  await setup();
  const first = within(screen.getByRole('group', { name: '账号 1' }));
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  expect(screen.getByRole('button', { name: '编辑账号 1' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(first.getByLabelText('邮箱地址')).not.toBeVisible();
  expect(second.getByLabelText('邮箱地址')).toBeVisible();
  expect(screen.getByText('已填写 · 待验证')).toBeVisible();
  fireEvent.change(second.getByLabelText('邮箱地址'), { target: { value: 'two@gmail.com' } });
  fireEvent.change(second.getByLabelText('应用专用密码'), {
    target: { value: 'test-second-code' },
  });
  fireEvent.click(screen.getByRole('button', { name: '编辑账号 1' }));
  expect(first.getByLabelText('邮箱地址')).toBeVisible();
  expect(first.getByLabelText('应用专用密码')).toHaveValue('test-first-code');
  expect(second.getByLabelText('邮箱地址')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '编辑账号 2' }));
  expect(second.getByLabelText('应用专用密码')).toHaveValue('test-second-code');
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('折叠中的未填写账号仍被校验，并自动展开首错再聚焦', async () => {
  await setup(false);
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  fireEvent.change(second.getByLabelText('邮箱地址'), { target: { value: 'two@gmail.com' } });
  fireEvent.change(second.getByLabelText('应用专用密码'), {
    target: { value: 'test-second-code' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  const first = within(screen.getByRole('group', { name: '账号 1' }));
  expect(first.getByLabelText('邮箱地址')).toBeVisible();
  expect(first.getByLabelText('邮箱地址')).toHaveFocus();
  expect(first.getByLabelText('邮箱地址')).toHaveAccessibleDescription(/请填写此项/);
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('错误摘要链接可以展开其他账号，移除当前项后仍有可见编辑区', async () => {
  await setup(false);
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  fireEvent.click(screen.getByRole('link', { name: '账号 2 · 邮箱地址' }));
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  expect(second.getByLabelText('邮箱地址')).toBeVisible();
  expect(second.getByLabelText('邮箱地址')).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '移除账号 2' }));
  await waitFor(() => expect(screen.getByLabelText('邮箱地址')).toBeVisible());
  expect(screen.queryByRole('group', { name: '账号 2' })).not.toBeInTheDocument();
});

it('当前编辑项有错时优先就地提示，摘要也可展开另一账号并精确聚焦密码', async () => {
  await setup(false);
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  expect(second.getByLabelText('邮箱地址')).toHaveFocus();
  const first = within(screen.getByRole('group', { name: '账号 1' }));
  expect(first.getByLabelText('邮箱地址')).not.toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: '账号 1 · 应用专用密码' }));
  expect(first.getByLabelText('应用专用密码')).toBeVisible();
  expect(first.getByLabelText('应用专用密码')).toHaveFocus();
  expect(second.getByLabelText('邮箱地址')).not.toBeVisible();
});

it('新增聚焦新项，删除当前项回退，删除首项后仍保留存活账号的凭据和焦点', async () => {
  await setup();
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  expect(second.getByLabelText('邮箱地址')).toHaveFocus();
  fireEvent.change(second.getByLabelText('邮箱地址'), { target: { value: 'two@gmail.com' } });
  fireEvent.change(second.getByLabelText('应用专用密码'), {
    target: { value: 'test-second-code' },
  });
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  const third = within(screen.getByRole('group', { name: '账号 3' }));
  expect(third.getByLabelText('邮箱地址')).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '移除账号 3' }));
  const first = within(screen.getByRole('group', { name: '账号 1' }));
  expect(first.getByLabelText('邮箱地址')).toHaveFocus();
  expect(first.getByLabelText('应用专用密码')).toHaveValue('test-first-code');
  expect(second.getByLabelText('邮箱地址')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '移除账号 1' }));
  expect(screen.queryByRole('group', { name: '账号 2' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('邮箱地址')).toHaveValue('two@gmail.com');
  expect(screen.getByLabelText('邮箱地址')).toHaveFocus();
  expect(screen.getByLabelText('应用专用密码')).toHaveValue('test-second-code');
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('摘要显示可选名称和待验证状态，不把本地完整性描述为已添加或回显密码', async () => {
  await setup();
  fireEvent.click(screen.getByRole('button', { name: '编辑账号 1' }));
  const first = within(screen.getByRole('group', { name: '账号 1' }));
  fireEvent.change(first.getByLabelText('账号名称'), {
    target: { value: '工作邮箱' },
  });
  fireEvent.click(screen.getByRole('button', { name: '编辑账号 2' }));
  const summary = screen.getByRole('button', { name: '编辑账号 1' });
  expect(summary).toHaveTextContent('one@gmail.com');
  expect(summary).toHaveTextContent('工作邮箱');
  expect(summary).toHaveTextContent('已填写 · 待验证');
  expect(summary).not.toHaveTextContent('已添加');
  expect(summary).not.toHaveTextContent('test-first-code');
  expect(summary).toHaveAccessibleDescription(/one@gmail.com.*工作邮箱.*已填写 · 待验证/);
  expect(api.addAccount).not.toHaveBeenCalled();
});

it('编辑旧账号在原位置展开，其他账号含未填写项始终保持原始顺序', async () => {
  await setup();
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  fireEvent.click(screen.getByRole('button', { name: '编辑账号 1' }));
  expect(
    screen
      .getAllByRole('group', { name: /^账号 [1-3]$/ })
      .map((row) => row.getAttribute('aria-label')),
  ).toEqual(['账号 1', '账号 2', '账号 3']);
  const first = within(screen.getByRole('group', { name: '账号 1' }));
  expect(first.getByLabelText('邮箱地址')).toBeVisible();
  expect(first.getByLabelText('邮箱地址')).toHaveFocus();
  const third = within(screen.getByRole('group', { name: '账号 3' }));
  expect(third.getByLabelText('邮箱地址')).not.toBeVisible();
  expect(third.getByRole('button', { name: '编辑账号 3' })).toHaveTextContent('点击展开填写');
  fireEvent.click(third.getByRole('button', { name: '编辑账号 3' }));
  expect(third.getByLabelText('邮箱地址')).toBeVisible();
  expect(first.getByLabelText('邮箱地址')).not.toBeVisible();
  expect(
    screen
      .getAllByRole('group', { name: /^账号 [1-3]$/ })
      .map((row) => row.getAttribute('aria-label')),
  ).toEqual(['账号 1', '账号 2', '账号 3']);
});

it('编辑旧账号期间移除末尾的非当前项，焦点回到当前可见编辑区而非隐藏末项', async () => {
  await setup();
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  fireEvent.click(screen.getByRole('button', { name: '编辑账号 1' }));
  fireEvent.click(screen.getByRole('button', { name: '移除账号 3' }));
  const first = within(screen.getByRole('group', { name: '账号 1' }));
  expect(first.getByLabelText('邮箱地址')).toBeVisible();
  expect(first.getByLabelText('邮箱地址')).toHaveFocus();
  expect(
    within(screen.getByRole('group', { name: '账号 2' })).getByLabelText('邮箱地址'),
  ).not.toBeVisible();
  expect(api.addAccount).not.toHaveBeenCalled();
});
