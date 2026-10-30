import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipHost } from './TooltipHost';
import { TOOLTIP_DELAY, TOOLTIP_HIDE_DELAY } from './useTooltip';

function Fixture({ text = '完整的提示说明', show = true, inert = false }) {
  return (
    <StrictMode>
      <TooltipHost />
      <p id="existing-help">已有帮助</p>
      <div {...(inert ? { inert: '' } : {})}>
        {show && (
          <button data-tooltip={text} aria-describedby="existing-help">
            <span>触发器</span>
          </button>
        )}
        <button disabled data-tooltip="暂不可用">
          禁用按钮
        </button>
        <button data-tooltip="另一条提示">其他按钮</button>
      </div>
    </StrictMode>
  );
}

function over(element: Element, pointerType = 'mouse') {
  const event = new Event('pointerover', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(element, event);
}
const advance = (delay = TOOLTIP_DELAY) => act(() => vi.advanceTimersByTime(delay));
const trigger = () => screen.getByRole('button', { name: '触发器' });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('统一悬浮提示', () => {
  it('悬停 400ms 后显示，离开过早不闪现', () => {
    render(<Fixture />);
    over(trigger());
    advance(TOOLTIP_DELAY - 1);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    advance(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent('完整的提示说明');
    expect(trigger()).not.toHaveAttribute('title');
    fireEvent.pointerOut(trigger(), { relatedTarget: document.body });
    advance(TOOLTIP_HIDE_DELAY);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    over(trigger());
    advance(100);
    fireEvent.pointerOut(trigger(), { relatedTarget: document.body });
    advance(1000);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('键盘聚焦立即显示，保留既有描述，Esc 只移除本提示关联', () => {
    render(<Fixture />);
    act(() => trigger().focus());
    const tooltip = screen.getByRole('tooltip');
    expect(trigger()).toHaveAccessibleDescription('已有帮助 完整的提示说明');
    expect(trigger().getAttribute('aria-describedby')).toContain(tooltip.id);
    fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-describedby', 'existing-help');
    expect(trigger()).toHaveFocus();
  });

  it('从图标移到按钮文字不重启计时，从触发器移入提示可保持阅读', () => {
    render(<Fixture />);
    over(trigger());
    advance(300);
    const label = screen.getByText('触发器');
    fireEvent.pointerOut(trigger(), { relatedTarget: label });
    over(label);
    advance(100);
    const tooltip = screen.getByRole('tooltip');
    fireEvent.pointerOut(trigger(), { relatedTarget: tooltip });
    over(tooltip);
    advance(1000);
    expect(tooltip).toBeInTheDocument();
    fireEvent.pointerOut(tooltip, { relatedTarget: document.body });
    advance(TOOLTIP_HIDE_DELAY);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('禁用按钮也能悬停解释，触屏不打开提示', () => {
    render(<Fixture />);
    const disabled = screen.getByRole('button', { name: '禁用按钮' });
    over(disabled, 'touch');
    advance();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    over(disabled);
    advance();
    expect(screen.getByRole('tooltip')).toHaveTextContent('暂不可用');
    expect(disabled).toBeDisabled();
  });

  it('快速切换只保留一条提示，不显示旧计时器内容', () => {
    render(<Fixture />);
    over(trigger());
    advance(200);
    over(screen.getByRole('button', { name: '其他按钮' }));
    advance();
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent('另一条提示');
    expect(trigger()).toHaveAttribute('aria-describedby', 'existing-help');
  });

  it.each(['pointerdown', 'scroll', 'resize', 'blur'])('%s 立即关闭且取消延迟任务', (name) => {
    render(<Fixture />);
    over(trigger());
    advance();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent(name === 'pointerdown' || name === 'scroll' ? document : window, new Event(name));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    advance(1000);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('语言或动态内容改变时更新文本，元素卸载后无残留', async () => {
    const view = render(<Fixture />);
    over(trigger());
    advance();
    view.rerender(<Fixture text="Updated tooltip" />);
    await act(async () => {});
    expect(screen.getByRole('tooltip')).toHaveTextContent('Updated tooltip');
    view.rerender(<Fixture show={false} />);
    await act(async () => {});
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('不将文本解释为 HTML，空白或超长内容不创建提示', async () => {
    const text = '<img src=x onerror=alert(1)>';
    const view = render(<Fixture text={text} />);
    over(trigger());
    advance();
    expect(screen.getByRole('tooltip')).toHaveTextContent(text);
    expect(screen.getByRole('tooltip').querySelector('img')).toBeNull();
    view.rerender(<Fixture text={'x'.repeat(1025)} />);
    await act(async () => {});
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    view.rerender(<Fixture text="   " />);
    over(trigger());
    advance();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('inert 内容不响应提示，组件卸载清理监听与计时器', () => {
    const view = render(<Fixture inert />);
    over(trigger());
    advance();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    view.rerender(<Fixture />);
    over(trigger());
    view.unmount();
    advance(1000);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dialog 内提示挂载在模态范围，第一次 Esc 不穿透关闭弹窗', () => {
    const escape = vi.fn();
    render(
      <>
        <TooltipHost />
        <dialog open onKeyDown={escape}>
          <button data-tooltip="关闭此弹窗">关闭</button>
        </dialog>
      </>,
    );
    const button = screen.getByRole('button', { name: '关闭' });
    act(() => button.focus());
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('tooltip'));
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(escape).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(escape).toHaveBeenCalledOnce();
  });
});
