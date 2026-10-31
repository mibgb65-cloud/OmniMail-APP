import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useStepIndicator } from './useStepIndicator';

let observers: ObserverMock[] = [];
class ObserverMock implements ResizeObserver {
  callback: ResizeObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }
}

function Fixture({ step = 1, secondTop = 80, locale = 'zh-CN' }) {
  const { trackRef, indicatorRef } = useStepIndicator(step, locale);
  return (
    <div ref={trackRef} data-track="">
      <div ref={indicatorRef} data-step-indicator="" />
      <ol>
        {[1, 2, 3, 4].map((value) => (
          <li
            key={value}
            data-position={value === 2 ? secondTop : (value - 1) * 80}
            aria-current={step === value ? 'step' : undefined}
          >
            {value}
          </li>
        ))}
      </ol>
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  observers = [];
  vi.stubGlobal('ResizeObserver', ObserverMock);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return new DOMRect(
      0,
      200 + Number(this.dataset.position ?? 0),
      160,
      this.tagName === 'LI' ? 64 : 320,
    );
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('先定位再启用动画，推进和返回始终复用背景且不重置动画开关', () => {
  const view = render(<Fixture />);
  const marker = view.container.querySelector('[data-step-indicator]');
  expect(marker).toHaveStyle({ transform: 'translateY(0px)', height: '64px' });
  expect(marker).toHaveAttribute('data-positioned', 'true');
  expect(marker).not.toHaveAttribute('data-animate');
  act(() => vi.advanceTimersByTime(40));
  expect(marker).toHaveAttribute('data-animate', 'true');
  view.rerender(<Fixture step={3} />);
  expect(view.container.querySelector('[data-step-indicator]')).toBe(marker);
  expect(marker).toHaveStyle({ transform: 'translateY(160px)' });
  view.rerender(<Fixture step={2} />);
  expect(marker).toHaveStyle({ transform: 'translateY(80px)' });
  expect(marker).toHaveAttribute('data-animate', 'true');
  view.unmount();
  expect(observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('文案/布局变化由 ResizeObserver 重新测量，语言切换同步位置', () => {
  const view = render(<Fixture step={2} />);
  const marker = view.container.querySelector('[data-step-indicator]');
  view.rerender(<Fixture step={2} secondTop={120} />);
  const observer = observers[0];
  if (!observer) throw new Error('未注册步骤尺寸观察器');
  act(() => observer.callback([], observer));
  expect(marker).toHaveStyle({ transform: 'translateY(120px)' });
  view.rerender(<Fixture step={2} secondTop={140} locale="en" />);
  expect(marker).toHaveStyle({ transform: 'translateY(140px)' });
});

it('无 ResizeObserver 时仍可定位和响应窗口变化，卸载后清理 RAF', () => {
  vi.stubGlobal('ResizeObserver', undefined);
  const view = render(<Fixture step={2} />);
  const marker = view.container.querySelector('[data-step-indicator]');
  view.rerender(<Fixture step={2} secondTop={100} />);
  fireEvent(window, new Event('resize'));
  expect(marker).toHaveStyle({ transform: 'translateY(100px)' });
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
