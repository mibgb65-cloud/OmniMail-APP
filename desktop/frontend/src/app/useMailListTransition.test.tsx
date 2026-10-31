import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMailListTransition } from './useMailListTransition';
import type { MailController } from './useMail';

const animation = vi.hoisted(() => ({ reveal: vi.fn(), cancel: vi.fn() }));
vi.mock('../lib/mail/mailReveal', () => ({ revealMailList: animation.reveal }));

function Stage(
  props: Pick<MailController, 'listLoading' | 'listPageCount'> & { listError?: unknown },
) {
  const { waiting, listRef } = useMailListTransition({ ...props, listError: props.listError });
  return (
    <div>
      <output data-testid="waiting">{String(waiting)}</output>
      <ul ref={listRef} hidden={waiting} />
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  animation.reveal.mockReset().mockReturnValue(animation.cancel);
  animation.cancel.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('慢请求的骨架等待与网络并行，数据就绪不再额外延迟', () => {
  const view = render(<Stage listLoading listPageCount={0} />);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByTestId('waiting')).toHaveTextContent('true');
  view.rerender(<Stage listLoading={false} listPageCount={1} />);
  expect(screen.getByTestId('waiting')).toHaveTextContent('false');
  expect(animation.reveal).toHaveBeenCalledOnce();
});

it('首批仅入场一次，后台重验或分页追加不重播，卸载清理动画和定时器', () => {
  const view = render(<Stage listLoading listPageCount={0} />);
  view.rerender(<Stage listLoading={false} listPageCount={1} />);
  act(() => vi.advanceTimersByTime(280));
  expect(animation.reveal).toHaveBeenCalledOnce();
  view.rerender(<Stage listLoading listPageCount={1} />);
  view.rerender(<Stage listLoading={false} listPageCount={2} />);
  expect(screen.getByTestId('waiting')).toHaveTextContent('false');
  expect(animation.reveal).toHaveBeenCalledOnce();
  view.unmount();
  expect(animation.cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('减少动态效果不等待最短动画窗口，运行中开启也可立即结束等待', () => {
  const media = new EventTarget();
  Object.defineProperty(media, 'matches', { value: true, writable: true });
  vi.stubGlobal('matchMedia', () => media);
  const view = render(<Stage listLoading listPageCount={0} />);
  view.rerender(<Stage listLoading={false} listPageCount={1} />);
  expect(screen.getByTestId('waiting')).toHaveTextContent('false');
  view.unmount();
  Object.defineProperty(media, 'matches', { value: false, writable: true });
  const next = render(<Stage listLoading listPageCount={0} />);
  next.rerender(<Stage listLoading={false} listPageCount={1} />);
  expect(screen.getByTestId('waiting')).toHaveTextContent('true');
  Object.defineProperty(media, 'matches', { value: true, writable: true });
  act(() => media.dispatchEvent(new Event('change')));
  expect(screen.getByTestId('waiting')).toHaveTextContent('false');
});

it('首批错误立即显示，仍在等数据时卸载不会留下旧的骨架计时器', () => {
  const view = render(
    <Stage listLoading={false} listPageCount={0} listError={new Error('NETWORK_FAILED')} />,
  );
  expect(screen.getByTestId('waiting')).toHaveTextContent('false');
  expect(animation.reveal).not.toHaveBeenCalled();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
