import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../../lib/bridge/ai';
import type { AIResult } from '../../lib/bridge/aiResult';
import type { MailDetail } from '../../lib/bridge/mail';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { MailAIPanel } from './MailAIPanel';

vi.mock('../../lib/bridge/ai', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/ai')>()),
  aiConfig: vi.fn(),
  cachedMailAI: vi.fn(),
  runMailAI: vi.fn(),
  aiProgress: vi.fn(),
}));
const detail: MailDetail = {
  id: 'mail_test',
  accountId: 'account_test',
  mailbox: 'INBOX',
  subject: 'subject',
  body: 'body',
  bodyVersion: 1,
  cached: true,
  from: 'private sender',
  to: 'private receiver',
  read: true,
  starred: false,
  receivedAt: 1,
  attachments: [],
};
const result: AIResult = {
  summary: '<img src=x onerror=alert(1)>',
  points: ['point'],
  tasks: [],
  facts: [],
  reply: '',
  mailId: 'mail_test',
  accountId: 'account_test',
  sourceHash: 'a'.repeat(64),
  revision: 'rev_1',
  action: 'analysis',
  language: 'zh',
  model: 'test',
  cached: false,
  warning: '',
};
const config: api.AIConfig = {
  endpoint: 'https://example.invalid/v1',
  model: 'test',
  language: 'zh',
  consent: true,
  hasKey: true,
  revision: 'rev_1',
};
beforeEach(() => {
  vi.mocked(api.aiConfig).mockReset().mockResolvedValue(config);
  vi.mocked(api.cachedMailAI).mockReset().mockResolvedValue(null);
  vi.mocked(api.aiProgress).mockReset().mockResolvedValue({ stage: 'generating', retrySeconds: 0 });
  vi.mocked(api.runMailAI)
    .mockReset()
    .mockImplementation(async (input) =>
      input.action === 'reply'
        ? { ...result, summary: '', points: [], action: 'reply', reply: 'synthetic reply' }
        : result,
    );
});
function view(
  value = detail,
  onAdopt?: (body: string) => boolean,
  hasDraft = false,
  suspended = false,
) {
  return (
    <I18nProvider initialLocale="zh-CN">
      <MailAIPanel
        detail={value}
        selectedId={value.id}
        onAdopt={onAdopt}
        hasDraft={hasDraft}
        hasSender
        suspended={suspended}
      />
    </I18nProvider>
  );
}
it('关闭后重新展开不会保留已取消任务的忙状态', async () => {
  vi.mocked(api.runMailAI).mockReturnValueOnce(new Promise(() => {}));
  const rendered = render(view());
  await waitFor(() => expect(screen.getByRole('button', { name: '分析这封邮件' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '分析这封邮件' }));
  rendered.rerender(view(detail, undefined, false, true));
  rendered.rerender(view());
  await waitFor(() => expect(screen.getByRole('button', { name: '分析这封邮件' })).toBeEnabled());
});
it('只读设置和缓存不外发，主动分析只传 ID 和动作，输出始终作为文本', async () => {
  render(view());
  await waitFor(() => expect(screen.getByRole('button', { name: '分析这封邮件' })).toBeEnabled());
  expect(api.runMailAI).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '分析这封邮件' }));
  await screen.findByText(result.summary);
  expect(document.querySelector('img')).toBeNull();
  expect(api.runMailAI).toHaveBeenCalledWith(
    { mailId: 'mail_test', action: 'analysis', intent: '', tone: '', regenerate: false },
    expect.any(AbortSignal),
  );
  fireEvent.click(screen.getByRole('button', { name: '重新分析（再次外发）' }));
  await waitFor(() =>
    expect(api.runMailAI).toHaveBeenLastCalledWith(
      expect.objectContaining({ regenerate: true }),
      expect.any(AbortSignal),
    ),
  );
});
it('重新打开只恢复本地缓存，缓存迟到不能覆盖新分析', async () => {
  let finish: (value: AIResult | null) => void = () => {};
  vi.mocked(api.cachedMailAI).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(view());
  await waitFor(() => expect(api.cachedMailAI).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '分析这封邮件' }));
  await screen.findByText(result.summary);
  await act(async () => finish({ ...result, summary: 'old cache', cached: true }));
  expect(screen.queryByText('old cache')).not.toBeInTheDocument();
});
it('换邮件取消旧请求，忽略不遵守取消的迟到结果', async () => {
  let finish: (value: AIResult) => void = () => {};
  vi.mocked(api.runMailAI).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const rendered = render(view());
  await waitFor(() => expect(screen.getByRole('button', { name: '分析这封邮件' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '分析这封邮件' }));
  const signal = vi.mocked(api.runMailAI).mock.calls[0]?.[1];
  rendered.rerender(view({ ...detail, id: 'mail_next' }));
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => finish(result));
  expect(screen.queryByText(result.summary)).not.toBeInTheDocument();
});
it('生成回复不采用；已有草稿不能覆盖，明确采用只传文本', async () => {
  const adopt = vi.fn(() => true);
  const rendered = render(view(detail, adopt, true));
  await waitFor(() => expect(screen.getByRole('button', { name: '分析这封邮件' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('你想怎样回复？'), { target: { value: '确认收到' } });
  fireEvent.click(screen.getByRole('button', { name: '生成回复建议' }));
  await screen.findByText('synthetic reply');
  expect(adopt).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '采用到撰写区' })).toBeDisabled();
  rendered.rerender(view(detail, adopt));
  fireEvent.click(screen.getByRole('button', { name: '采用到撰写区' }));
  expect(adopt).toHaveBeenCalledWith('synthetic reply');
});
