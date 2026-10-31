import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_STORAGE_KEY } from './theme';
import { useTheme } from './useTheme';
import { useThemeTransition } from './useThemeTransition';

function deferred() {
  let resolve = () => {};
  let reject = () => {};
  const promise = new Promise<void>((accept, fail) => {
    resolve = accept;
    reject = () => fail(new Error('transition skipped'));
  });
  return { promise, resolve, reject };
}

function Preview({ onToggle }: { onToggle: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { toggleThemeWithTransition, isTransitioning } = useThemeTransition(() => {
    onToggle();
    toggleTheme();
  });
  return (
    <button type="button" aria-busy={isTransitioning} onClick={toggleThemeWithTransition}>
      {theme}
    </button>
  );
}

const initialStart = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
const initialAnimate = Object.getOwnPropertyDescriptor(document.documentElement, 'animate');

function mockTransition() {
  const ready = deferred();
  const finished = deferred();
  const animationFinished = deferred();
  const skipTransition = vi.fn();
  const cancel = vi.fn();
  const animate = vi.fn<
    (
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: KeyframeAnimationOptions,
    ) => { cancel: () => void; finished: Promise<void> }
  >(() => ({ cancel, finished: animationFinished.promise }));
  let update: (() => void) | undefined;
  const start = vi.fn((callback: () => void) => {
    update = callback;
    return { ready: ready.promise, finished: finished.promise, skipTransition };
  });
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
  Object.defineProperty(document.documentElement, 'animate', {
    configurable: true,
    value: animate,
  });
  return {
    ready,
    finished,
    animationFinished,
    skipTransition,
    cancel,
    animate,
    start,
    update: () => update?.(),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'light';
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(document.documentElement, 'animate', {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themeTransition;
  if (initialStart) Object.defineProperty(document, 'startViewTransition', initialStart);
  else Reflect.deleteProperty(document, 'startViewTransition');
  if (initialAnimate) Object.defineProperty(document.documentElement, 'animate', initialAnimate);
  else Reflect.deleteProperty(document.documentElement, 'animate');
});

describe('点击位置圆形扩散主题切换', () => {
  it('完整结束后释放 WAAPI 动画，不向下一次切换遗留填充效果', async () => {
    const api = mockTransition();
    render(<Preview onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    act(api.update);
    await act(async () => api.ready.resolve());
    await act(async () => {
      api.animationFinished.resolve();
      api.finished.resolve();
    });
    expect(api.cancel).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
  });

  it('原生结束通知早于扩散动画时，不提前释放标记或启动下一次切换', async () => {
    const api = mockTransition();
    render(<Preview onToggle={vi.fn()} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    act(api.update);
    await act(async () => api.ready.resolve());
    await act(async () => api.finished.resolve());
    expect(document.documentElement).toHaveAttribute('data-theme-transition', 'circular');
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(api.start).toHaveBeenCalledOnce();
    await act(async () => api.animationFinished.resolve());
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
    expect(api.cancel).toHaveBeenCalledOnce();
  });

  it('动画先结束时仍等待原生过渡，完成后下一轮使用独立生命周期', async () => {
    const first = mockTransition();
    const onToggle = vi.fn();
    render(<Preview onToggle={onToggle} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    act(first.update);
    await act(async () => first.ready.resolve());
    await act(async () => first.animationFinished.resolve());
    expect(document.documentElement).toHaveAttribute('data-theme-transition', 'circular');
    expect(first.cancel).not.toHaveBeenCalled();
    await act(async () => first.finished.resolve());
    expect(first.cancel).toHaveBeenCalledOnce();

    const second = mockTransition();
    fireEvent.click(button);
    act(second.update);
    await act(async () => second.ready.resolve());
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(second.cancel).not.toHaveBeenCalled();
    await act(async () => {
      second.animationFinished.resolve();
      second.finished.resolve();
    });
    expect(second.cancel).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute('aria-busy', 'false');
  });

  it('扩散动画被中断时跳过原生过渡并完成清理', async () => {
    const api = mockTransition();
    const onToggle = vi.fn();
    render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    act(api.update);
    await act(async () => api.ready.resolve());
    await act(async () => api.animationFinished.reject());
    expect(api.skipTransition).toHaveBeenCalledOnce();
    await act(async () => api.finished.resolve());
    expect(api.cancel).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
  });

  it('缺少 View Transitions API 时普通切换且保留偏好', () => {
    const onToggle = vi.fn();
    render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('在快照回调同步提交主题，从点击点以 700ms 扩散至最远角', async () => {
    const api = mockTransition();
    const onToggle = vi.fn();
    render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'), { clientX: 120, clientY: 80, detail: 1 });
    expect(onToggle).not.toHaveBeenCalled();
    act(api.update);
    expect(document.documentElement.dataset.theme).toBe('dark');
    await act(async () => api.ready.resolve());
    const radius = Math.hypot(
      Math.max(120, window.innerWidth - 120),
      Math.max(80, window.innerHeight - 80),
    );
    expect(api.animate).toHaveBeenCalledWith(
      { clipPath: ['circle(0px at 120px 80px)', `circle(${radius}px at 120px 80px)`] },
      {
        duration: 700,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)',
        fill: 'backwards',
      },
    );
    await act(async () => {
      api.animationFinished.resolve();
      api.finished.resolve();
    });
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false');
  });

  it('键盘激活使用按钮中心，过渡中连续点击不会重复启动', async () => {
    const api = mockTransition();
    const onToggle = vi.fn();
    render(<Preview onToggle={onToggle} />);
    const button = screen.getByRole('button');
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(900, 10, 40, 40));
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.start).toHaveBeenCalledOnce();
    act(api.update);
    await act(async () => api.ready.resolve());
    expect(api.animate.mock.calls[0]?.[0]).toEqual({
      clipPath: [
        'circle(0px at 920px 30px)',
        `circle(${Math.hypot(920, window.innerHeight - 30)}px at 920px 30px)`,
      ],
    });
    expect(onToggle).toHaveBeenCalledOnce();
    await act(async () => {
      api.animationFinished.resolve();
      api.finished.resolve();
    });
    fireEvent.click(button);
    expect(api.start).toHaveBeenCalledTimes(2);
  });

  it('将越界点击坐标限制在视口范围内', async () => {
    const api = mockTransition();
    render(<Preview onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'), {
      clientX: -20,
      clientY: window.innerHeight + 50,
      detail: 1,
    });
    act(api.update);
    await act(async () => api.ready.resolve());
    expect(api.animate.mock.calls[0]?.[0]).toEqual({
      clipPath: [
        `circle(0px at 0px ${window.innerHeight}px)`,
        `circle(${Math.hypot(window.innerWidth, window.innerHeight)}px at 0px ${window.innerHeight}px)`,
      ],
    });
    await act(async () => {
      api.animationFinished.resolve();
      api.finished.resolve();
    });
  });

  it('减少动态效果或缺少伪元素动画能力时直接切换', () => {
    const api = mockTransition();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('reduced-motion'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const onToggle = vi.fn();
    const view = render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(api.start).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledOnce();
    view.unmount();
    vi.unstubAllGlobals();
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      value: undefined,
    });
    render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(api.start).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('启动抛错时降级，状态只提交一次', () => {
    const api = mockTransition();
    api.start.mockImplementation(() => {
      throw new Error('unsupported');
    });
    const onToggle = vi.fn();
    render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
  });

  it('快照失败时补交主题，迟到的原回调不重复切换', async () => {
    const api = mockTransition();
    const onToggle = vi.fn();
    render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    await act(async () => api.ready.reject());
    act(api.update);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(api.animate).not.toHaveBeenCalled();
    expect(api.skipTransition).toHaveBeenCalledOnce();
    await act(async () => api.finished.resolve());
  });

  it('伪元素动画失败时不回滚主题，结束时清理状态', async () => {
    const api = mockTransition();
    api.animate.mockImplementation(() => {
      throw new Error('unsupported pseudo element');
    });
    const onToggle = vi.fn();
    render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    act(api.update);
    await act(async () => api.ready.resolve());
    expect(onToggle).toHaveBeenCalledOnce();
    expect(api.skipTransition).toHaveBeenCalledOnce();
    await act(async () => api.finished.reject());
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
  });

  it('卸载后跳过过渡，迟到回调不会提交主题', async () => {
    const api = mockTransition();
    const onToggle = vi.fn();
    const view = render(<Preview onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    view.unmount();
    act(api.update);
    await act(async () => {
      api.ready.resolve();
      api.finished.resolve();
    });
    expect(onToggle).not.toHaveBeenCalled();
    expect(api.skipTransition).toHaveBeenCalledOnce();
    expect(api.animate).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
  });

  it('动画开始后卸载会取消动画并移除临时样式标记', async () => {
    const api = mockTransition();
    const view = render(<Preview onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    act(api.update);
    await act(async () => api.ready.resolve());
    view.unmount();
    expect(api.cancel).toHaveBeenCalledOnce();
    expect(api.skipTransition).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
    await act(async () => api.finished.resolve());
  });
});
