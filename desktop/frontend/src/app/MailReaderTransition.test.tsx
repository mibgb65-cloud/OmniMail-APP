import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { MailDetail } from '../lib/bridge/mail';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import type { ReaderPageOptions } from './MailReaderTransition';
import { MailReaderTransition } from './MailReaderTransition';

const calls = vi.hoisted(() => ({
  ready: new Map<string, () => void>(),
  slow: new Map<string, (read: () => void) => void>(),
  reveal: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('../lib/mail/mailReveal', () => ({ revealMailPage: calls.reveal }));
vi.mock('./MailReaderPage', () => ({
  MailReaderPage: ({ detail, options }: { detail: MailDetail; options: ReaderPageOptions }) => {
    if (options.onReady) calls.ready.set(detail.id, options.onReady);
    if (options.onSlow) calls.slow.set(detail.id, options.onSlow);
    return (
      <div data-testid={`content-${detail.id}`} data-managed={options.transitionManaged}>
        <h2>{detail.subject}</h2>
        <button disabled={!options.interactive}>操作 {detail.id}</button>
      </div>
    );
  },
}));
const message = (id: string): MailDetail => ({
  id,
  accountId: 'test',
  mailbox: 'INBOX',
  subject: `邮件 ${id}`,
  from: 'sender@example.invalid',
  to: 'reader@example.invalid',
  receivedAt: 1,
  read: false,
  starred: false,
  cached: true,
  body: id,
  attachments: [],
});
const a = message('a'),
  b = message('b'),
  c = message('c');
const retry = vi.fn();
const viewed = vi.fn();
const content = (selected: string, detail?: MailDetail, error?: unknown) => (
  <I18nProvider initialLocale="zh-CN">
    <section data-mail-reader>
      <MailReaderTransition
        selected={selected}
        detail={detail}
        error={error}
        onRetry={retry}
        busy={!detail}
        onRefresh={vi.fn()}
        onViewed={viewed}
      />
    </section>
  </I18nProvider>
);
beforeEach(() => {
  vi.useFakeTimers();
  calls.ready.clear();
  calls.slow.clear();
  calls.reveal.mockReset().mockReturnValue(calls.cancel);
  calls.cancel.mockClear();
  retry.mockClear();
  viewed.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('切换缓存邮件也立即显示骨架，旧邮件彻底卸载而不是半透明穿透', async () => {
  const view = render(content('a', a));
  view.rerender(content('b', b));
  expect(screen.queryByTestId('content-a')).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
  await act(async () => calls.ready.get('b')?.());
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
  act(() => vi.advanceTimersByTime(280));
  expect(screen.queryByRole('status', { name: '正在加载邮件内容' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '邮件 b' })).toBeVisible();
  expect(document.querySelectorAll('[data-mail-page]')).toHaveLength(1);
});

it('阅读区等待使用满高骨架，并提供下半区的正文占位', () => {
  render(content('b'));
  const skeleton = screen.getByRole('status', { name: '正在加载邮件内容' });
  expect(skeleton).toHaveAttribute('data-fill', 'true');
  expect(skeleton.querySelectorAll('[data-skeleton-continuation]')).toHaveLength(2);
});

it('仅在当前正文就绪且骨架结束后通知一次已查看，不因元数据更新重复标记', async () => {
  const view = render(content('a', a));
  expect(viewed).not.toHaveBeenCalled();
  await act(async () => calls.ready.get('a')?.());
  expect(viewed).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(280));
  expect(viewed).toHaveBeenCalledExactlyOnceWith('a');
  view.rerender(content('a', { ...a, read: true }));
  view.rerender(content('a', { ...a, read: false }));
  expect(viewed).toHaveBeenCalledTimes(1);
});

it('快速切走、失败和过期就绪回调不产生已查看通知', async () => {
  const view = render(content('a', a));
  const stale = calls.ready.get('a');
  view.rerender(content('b', b));
  await act(async () => stale?.());
  act(() => vi.advanceTimersByTime(280));
  expect(viewed).not.toHaveBeenCalled();
  view.rerender(content('b', undefined, new Error('NETWORK_FAILED')));
  expect(viewed).not.toHaveBeenCalled();
});

it('后台窗口与 aria-hidden 阅读区不视为已查看，恢复可见后才通知', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const view = render(<div aria-hidden="true">{content('a', a)}</div>);
  await act(async () => calls.ready.get('a')?.());
  act(() => vi.advanceTimersByTime(280));
  expect(viewed).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(viewed).not.toHaveBeenCalled();
  view.rerender(<div>{content('a', a)}</div>);
  await act(async () => {
    await Promise.resolve();
  });
  expect(viewed).toHaveBeenCalledExactlyOnceWith('a');
});

it('设置等弹窗遮挡期间不标记，关闭弹窗后当前正文仍可见才通知', async () => {
  const dialog = document.createElement('dialog');
  dialog.open = true;
  document.body.append(dialog);
  render(content('a', a));
  await act(async () => calls.ready.get('a')?.());
  act(() => vi.advanceTimersByTime(280));
  expect(viewed).not.toHaveBeenCalled();
  dialog.open = false;
  act(() => dialog.dispatchEvent(new Event('close')));
  expect(viewed).toHaveBeenCalledExactlyOnceWith('a');
  dialog.remove();
});

it('保留正文的重试仍在读取时不消耗通知，成功后再通知已查看', async () => {
  const renderCurrent = (busy: boolean) => (
    <I18nProvider initialLocale="zh-CN">
      <section data-mail-reader>
        <MailReaderTransition
          selected="a"
          detail={a}
          onRetry={retry}
          onRefresh={vi.fn()}
          onViewed={viewed}
          busy={busy}
        />
      </section>
    </I18nProvider>
  );
  const view = render(renderCurrent(true));
  await act(async () => calls.ready.get('a')?.());
  act(() => vi.advanceTimersByTime(280));
  expect(viewed).not.toHaveBeenCalled();
  view.rerender(renderCurrent(false));
  expect(viewed).toHaveBeenCalledExactlyOnceWith('a');
});

it('只在当前页就绪时启动分段入场，星标更新不重播，快切取消旧动画', async () => {
  const view = render(content('a', a));
  expect(calls.reveal).not.toHaveBeenCalled();
  await act(async () => calls.ready.get('a')?.());
  act(() => vi.advanceTimersByTime(280));
  expect(calls.reveal).toHaveBeenCalledOnce();
  view.rerender(content('a', { ...a, starred: true }));
  expect(calls.reveal).toHaveBeenCalledOnce();
  view.rerender(content('b', b));
  expect(calls.cancel).toHaveBeenCalledOnce();
  expect(screen.queryByTestId('content-a')).not.toBeInTheDocument();
});

it('慢请求不在内容准备好后额外叠加一段视觉等待', async () => {
  const view = render(content('a', a));
  view.rerender(content('b'));
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
  view.rerender(content('b', b));
  await act(async () => calls.ready.get('b')?.());
  expect(screen.getByRole('button', { name: '操作 b' })).toBeEnabled();
});

it('快速选择和 A→B→A 只接受最新目标，旧就绪回调不能揭开新邮件', async () => {
  const view = render(content('a', a));
  view.rerender(content('b', b));
  const stale = calls.ready.get('b');
  view.rerender(content('c', c));
  await act(async () => stale?.());
  act(() => vi.advanceTimersByTime(280));
  expect(screen.queryByTestId('content-b')).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
  await act(async () => calls.ready.get('c')?.());
  expect(screen.getByRole('heading', { name: '邮件 c' })).toBeVisible();
  view.rerender(content('b', b));
  view.rerender(content('a', a));
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
  await act(async () => calls.ready.get('a')?.());
  act(() => vi.advanceTimersByTime(280));
  expect(screen.getByRole('heading', { name: '邮件 a' })).toBeVisible();
});

it('忽略与选择不符的详情，错误停止骨架且不残留旧内容，重试仍可操作', () => {
  const view = render(content('a', a));
  view.rerender(content('b', a));
  expect(screen.queryByTestId('content-a')).not.toBeInTheDocument();
  expect(document.querySelectorAll('[data-mail-page]')).toHaveLength(0);
  view.rerender(content('b', undefined, new Error('NETWORK_FAILED private-marker')));
  expect(screen.queryByRole('status', { name: '正在加载邮件内容' })).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).not.toHaveTextContent('private-marker');
  fireEvent.click(screen.getByRole('button', { name: '重新加载正文' }));
  expect(retry).toHaveBeenCalledOnce();
  view.rerender(content(''));
  expect(document.querySelectorAll('[data-mail-page]')).toHaveLength(0);
});

it('慢图片先读入口直接可用，准备期间按钮不可操作，正文不再播放入场动画', async () => {
  const view = render(content('a', a));
  view.rerender(content('b', b));
  const read = vi.fn();
  act(() => calls.slow.get('b')?.(read));
  fireEvent.click(screen.getByRole('button', { name: '先阅读正文' }));
  expect(read).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: '操作 b', hidden: true })).toBeDisabled();
  await act(async () => calls.ready.get('b')?.());
  act(() => vi.advanceTimersByTime(280));
  expect(screen.getByTestId('content-b')).toHaveAttribute('data-managed', 'true');
});

it('减少动态偏好不强制视觉等待，元信息更新不会重新闪骨架', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  const view = render(content('a', a));
  view.rerender(content('b', b));
  await act(async () => calls.ready.get('b')?.());
  act(() => vi.advanceTimersByTime(0));
  expect(screen.getByRole('heading', { name: '邮件 b' })).toBeVisible();
  view.rerender(content('b', { ...b, starred: true }));
  expect(screen.queryByRole('status', { name: '正在加载邮件内容' })).not.toBeInTheDocument();
});
