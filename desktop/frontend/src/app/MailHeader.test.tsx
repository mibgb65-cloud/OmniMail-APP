import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { copyMailAddresses } from '../lib/bridge/clipboard';
import { MailHeader } from './MailHeader';

vi.mock('../lib/bridge/clipboard', async (original) => ({
  ...(await original<typeof import('../lib/bridge/clipboard')>()),
  copyMailAddresses: vi.fn().mockResolvedValue(undefined),
}));
const props = {
  subject: '脱敏邮件主题',
  from: 'sender@example.invalid',
  to: 'one@example.invalid, two@example.invalid',
  receivedAt: 1793318400000,
};
const header = (overrides: Partial<typeof props> = {}, locale: 'zh-CN' | 'en' = 'zh-CN') => (
  <I18nProvider initialLocale={locale}>
    <MailHeader {...props} {...overrides} />
  </I18nProvider>
);

it('主题、收发件人和语义时间独立展示，分别复制并反馈成功', async () => {
  render(header());
  expect(screen.getByRole('heading', { name: props.subject })).toBeVisible();
  expect(document.querySelector('time')).toHaveAttribute(
    'datetime',
    new Date(props.receivedAt).toISOString(),
  );
  fireEvent.click(screen.getByRole('button', { name: '复制发件人邮箱' }));
  expect(copyMailAddresses).toHaveBeenLastCalledWith(props.from);
  expect(await screen.findByRole('status')).toHaveTextContent('已复制');
  fireEvent.click(screen.getByRole('button', { name: '复制收件人邮箱' }));
  expect(copyMailAddresses).toHaveBeenLastCalledWith(props.to);
});

it('失败有可操作提示而不暴露诊断；切换字段不会继承旧成功结果', async () => {
  vi.mocked(copyMailAddresses).mockRejectedValueOnce(new Error('private marker'));
  const view = render(header());
  fireEvent.click(screen.getByRole('button', { name: '复制发件人邮箱' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('请手动选择');
  expect(screen.queryByText(/private marker/)).not.toBeInTheDocument();
  let resolve: () => void = () => {};
  vi.mocked(copyMailAddresses).mockReturnValueOnce(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '复制收件人邮箱' }));
  view.rerender(header({ to: 'new@example.invalid' }));
  await act(async () => resolve());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('无主题、空收件人和非法时间安全回退，英文复制标签可用', () => {
  render(header({ subject: '', from: '', to: '', receivedAt: NaN }, 'en'));
  expect(screen.getByRole('heading', { name: '(No subject)' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Copy sender email' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Copy recipient emails' })).toBeDisabled();
  expect(document.querySelector('time')).not.toHaveAttribute('datetime');
});
it('标题星标可标记/取消，保存中与旧过渡页均禁止操作', () => {
  const toggle = vi.fn();
  const content = (starred: boolean, pending = false, interactive = true) => (
    <I18nProvider initialLocale="zh-CN">
      <MailHeader {...props} interactive={interactive} star={{ starred, pending, toggle }} />
    </I18nProvider>
  );
  const view = render(content(false));
  fireEvent.click(screen.getByRole('button', { name: '标记星标' }));
  expect(toggle).toHaveBeenCalledOnce();
  view.rerender(content(true, true));
  const star = screen.getByRole('button', { name: '取消星标' });
  expect(star).toHaveAttribute('aria-pressed', 'true');
  expect(star).toHaveAttribute('aria-busy', 'true');
  expect(star).toBeDisabled();
  view.rerender(content(true, false, false));
  expect(screen.getByRole('button', { name: '取消星标' })).toBeDisabled();
});
