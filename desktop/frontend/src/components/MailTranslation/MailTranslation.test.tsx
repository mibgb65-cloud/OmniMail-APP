import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { MailDetail } from '../../lib/bridge/mail';
import * as api from '../../lib/bridge/translation';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { MailTranslationProvider } from './MailTranslationContext';
import { MailTranslateAction } from './MailTranslateAction';
import { MailReaderPage } from '../../app/MailReaderPage';

vi.mock('../../lib/bridge/translation', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/translation')>()),
  translationPreferences: vi.fn(),
  saveTranslationPreferences: vi.fn(),
  translateMail: vi.fn(),
  cachedTranslation: vi.fn(),
}));
const detail: MailDetail = {
  id: 'mail_test',
  accountId: 'account_test',
  mailbox: 'INBOX',
  subject: 'Original subject',
  from: 'sender@example.invalid',
  to: 'reader@example.invalid',
  receivedAt: 1,
  read: true,
  starred: false,
  cached: true,
  body: 'Original body',
  bodyVersion: 1,
  attachments: [],
};
const result: api.TranslationResult = {
  mailId: detail.id,
  sourceHash: 'a'.repeat(64),
  target: 'zh',
  model: 'Index-Translate-35B-A3B',
  subject: '译文标题',
  body: '<script>alert("unsafe")</script>\n译文正文',
  cached: false,
};
function view(
  value: MailDetail | undefined = detail,
  selected = value?.id ?? '',
  suspended = false,
) {
  return (
    <I18nProvider initialLocale="zh-CN">
      <MailTranslationProvider detail={value} selectedId={selected} suspended={suspended}>
        <MailTranslateAction />
        {value && (
          <MailReaderPage
            detail={value}
            options={{ interactive: true, transitionManaged: false }}
            busy={false}
            onRefresh={vi.fn()}
          />
        )}
      </MailTranslationProvider>
    </I18nProvider>
  );
}
beforeEach(() => {
  vi.mocked(api.translationPreferences)
    .mockReset()
    .mockResolvedValue({ target: 'zh', consent: false });
  vi.mocked(api.saveTranslationPreferences).mockReset().mockResolvedValue(undefined);
  vi.mocked(api.translateMail)
    .mockReset()
    .mockImplementation(async (_id, target) => ({ ...result, target }));
  vi.mocked(api.cachedTranslation).mockReset().mockResolvedValue(null);
});
async function open() {
  fireEvent.click(screen.getByRole('button', { name: '翻译标题和正文' }));
  const dialog = screen.getByRole('dialog', { name: '翻译邮件' });
  await waitFor(() => expect(within(dialog).getByRole('checkbox')).toBeEnabled());
  return dialog;
}
async function start() {
  const dialog = await open();
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(within(dialog).getByRole('button', { name: '开始翻译' }));
}
it('没有选中或正文不完整时禁用，不自动发送邮件', () => {
  const rendered = render(view(undefined, ''));
  expect(screen.getByRole('button', { name: '翻译标题和正文' })).toBeDisabled();
  rendered.rerender(view({ ...detail, bodyErrorCode: 'MESSAGE_TEXT_TOO_LARGE' }));
  expect(screen.getByRole('button', { name: '翻译标题和正文' })).toBeDisabled();
  rendered.rerender(view(detail, detail.id, true));
  expect(screen.getByRole('button', { name: '翻译标题和正文' })).toBeDisabled();
  expect(api.translateMail).not.toHaveBeenCalled();
});
it('源语言自动、目标可保存，授权后同时显示标题和正文译文且不执行 HTML', async () => {
  render(view());
  const dialog = await open();
  expect(within(dialog).getByText('原始语言：自动识别，由翻译模型判断')).toBeVisible();
  expect(within(dialog).getByRole('button', { name: '开始翻译' })).toBeDisabled();
  expect(api.translateMail).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('radio', { name: '日语' }));
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(within(dialog).getByRole('button', { name: '开始翻译' }));
  expect(await screen.findByRole('heading', { name: '译文标题' })).toBeVisible();
  expect(screen.getByText(/alert\("unsafe"\)/)).toHaveTextContent('译文正文');
  expect(document.querySelector('script')).toBeNull();
  expect(api.saveTranslationPreferences).toHaveBeenCalledWith(
    { target: 'ja', consent: true },
    expect.any(AbortSignal),
  );
  expect(api.translateMail).toHaveBeenCalledWith(detail.id, 'ja', expect.any(AbortSignal));
  const toggle = screen.getByRole('switch', { name: '显示译文' });
  expect(toggle).toBeChecked();
  expect(screen.queryByRole('group', { name: '阅读模式' })).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(screen.getByRole('heading', { name: 'Original subject' })).toBeVisible();
  expect(screen.getByText('Original body')).toBeVisible();
  fireEvent.click(toggle);
  expect(screen.getByRole('heading', { name: '译文标题' })).toBeVisible();
});
it('仅保存/撤销授权不会发起翻译，设置读取或保存失败不外发', async () => {
  render(view());
  let dialog = await open();
  fireEvent.click(within(dialog).getByRole('button', { name: '仅保存设置' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.saveTranslationPreferences).toHaveBeenCalledWith(
    { target: 'zh', consent: false },
    expect.any(AbortSignal),
  );
  expect(api.translateMail).not.toHaveBeenCalled();
  vi.mocked(api.saveTranslationPreferences).mockRejectedValueOnce(new Error('private-token'));
  dialog = await open();
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(within(dialog).getByRole('button', { name: '开始翻译' }));
  expect(await within(dialog).findByRole('alert')).not.toHaveTextContent('private-token');
  expect(api.translateMail).not.toHaveBeenCalled();
});
it('切换邮件取消旧任务，忽略迟到的标题正文，不串到下一封', async () => {
  let finish: (value: api.TranslationResult) => void = () => {};
  vi.mocked(api.translateMail).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const rendered = render(view());
  await start();
  await waitFor(() => expect(api.translateMail).toHaveBeenCalledOnce());
  const signal = vi.mocked(api.translateMail).mock.calls[0]?.[2];
  rendered.rerender(
    view({ ...detail, id: 'next_mail', subject: 'Next subject', body: 'Next body' }),
  );
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(result));
  expect(screen.getByRole('heading', { name: 'Next subject' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '译文标题' })).not.toBeInTheDocument();
});
it('取消任务保留原文，错误安全展示', async () => {
  vi.mocked(api.translateMail).mockReturnValueOnce(new Promise(() => {}));
  render(view());
  await start();
  await waitFor(() => expect(api.translateMail).toHaveBeenCalledOnce());
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '翻译邮件' })).not.toBeInTheDocument(),
  );
  const cancel = screen.getByRole('button', { name: '翻译标题和正文' });
  const signal = vi.mocked(api.translateMail).mock.calls[0]?.[2];
  fireEvent.click(cancel);
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole('heading', { name: 'Original subject' })).toBeVisible();
  vi.mocked(api.translationPreferences).mockResolvedValue({ target: 'zh', consent: true });
  vi.mocked(api.translateMail).mockRejectedValueOnce(new Error('TRANSLATION_RATE_LIMITED private'));
  const dialog = await open();
  fireEvent.click(within(dialog).getByRole('button', { name: '开始翻译' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('免费翻译服务当前限流');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private');
});
it('打开弹窗后切换目标邮件不会对新邮件自动弹窗或上传', async () => {
  const rendered = render(view());
  await open();
  rendered.rerender(view({ ...detail, id: 'next_mail', subject: 'Next' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.translateMail).not.toHaveBeenCalled();
});
it('重新打开邮件只恢复本地缓存与原译开关，不自动调用公网', async () => {
  vi.mocked(api.cachedTranslation).mockResolvedValue({ ...result, cached: true });
  const rendered = render(view());
  const toggle = await screen.findByRole('switch', { name: '显示译文' });
  expect(toggle).not.toBeChecked();
  expect(api.translateMail).not.toHaveBeenCalled();
  fireEvent.click(toggle);
  expect(screen.getByRole('heading', { name: '译文标题' })).toBeVisible();
  rendered.rerender(view({ ...detail, id: 'other_mail', subject: 'Other' }));
  await waitFor(() =>
    expect(screen.queryByRole('switch', { name: '显示译文' })).not.toBeInTheDocument(),
  );
  vi.mocked(api.cachedTranslation).mockResolvedValue({ ...result, cached: true });
  rendered.rerender(view({ ...detail }));
  expect(await screen.findByRole('switch', { name: '显示译文' })).not.toBeChecked();
  expect(api.translateMail).not.toHaveBeenCalled();
});
it('旧缓存迟到不能覆盖用户刚完成的新翻译', async () => {
  let finish: (value: api.TranslationResult | null) => void = () => {};
  vi.mocked(api.cachedTranslation).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(view());
  await start();
  expect(await screen.findByRole('heading', { name: '译文标题' })).toBeVisible();
  await act(async () => finish({ ...result, subject: '旧缓存', cached: true }));
  expect(screen.getByRole('heading', { name: '译文标题' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '旧缓存' })).not.toBeInTheDocument();
});
