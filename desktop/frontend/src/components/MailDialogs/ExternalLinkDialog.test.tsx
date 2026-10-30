import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { openMailLink } from '../../lib/bridge/links';
import { ExternalLinkDialog } from './ExternalLinkDialog';

vi.mock('../../lib/bridge/links', () => ({ openMailLink: vi.fn().mockResolvedValue(undefined) }));
beforeEach(() => vi.mocked(openMailLink).mockClear());
const renderDialog = (url = 'https://example.invalid/path') => {
  const onClose = vi.fn();
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <ExternalLinkDialog url={url} onClose={onClose} />
    </I18nProvider>,
  );
  return { ...view, onClose };
};

it('显示真实目标与风险，默认聚焦取消；只有确认后才交系统打开', async () => {
  renderDialog();
  expect(screen.getByRole('dialog')).toHaveAccessibleName('打开邮件中的链接？');
  expect(screen.getByText(/OmniMail 未验证其安全性/)).toBeVisible();
  expect(screen.getByText('https://example.invalid/path')).toBeVisible();
  expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
  expect(openMailLink).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '继续打开' }));
  expect(openMailLink).toHaveBeenCalledExactlyOnceWith('https://example.invalid/path');
});
it.each(['cancel', 'escape'])('%s 关闭不会触发外链', async (mode) => {
  const { onClose } = renderDialog();
  if (mode === 'cancel') fireEvent.click(screen.getByRole('button', { name: '取消' }));
  else fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(openMailLink).not.toHaveBeenCalled();
});
it('打开失败可安全重试，非法协议不能确认打开', async () => {
  vi.mocked(openMailLink).mockRejectedValueOnce(new Error('private-details'));
  const view = renderDialog();
  fireEvent.click(screen.getByRole('button', { name: '继续打开' }));
  await screen.findByRole('alert');
  expect(screen.queryByText(/private-details/)).not.toBeInTheDocument();
  view.unmount();
  renderDialog('javascript:alert(1)');
  expect(screen.getByRole('button', { name: '继续打开' })).toBeDisabled();
  await act(async () => {});
});
