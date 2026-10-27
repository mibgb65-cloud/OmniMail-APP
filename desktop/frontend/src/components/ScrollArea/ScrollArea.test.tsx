import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScrollArea } from './ScrollArea';

/** jsdom 不做布局，这里直接给定量出来的尺寸，模拟真实溢出场景。 */
function applyMetrics(
  element: Element,
  values: { clientHeight: number; scrollHeight?: number; scrollTop?: number },
) {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: values.clientHeight,
  });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: values.scrollHeight ?? values.clientHeight,
  });
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    writable: true,
    value: values.scrollTop ?? 0,
  });
}

function renderArea() {
  const view = render(
    <ScrollArea data-testid="viewport">
      <p>内容</p>
    </ScrollArea>,
  );
  const viewport = view.getByTestId('viewport');
  const root = viewport.parentElement as HTMLElement;
  const track = root.querySelector<HTMLElement>('[data-scrollbar-track]')!;
  const thumb = root.querySelector<HTMLElement>('[data-scrollbar-thumb]')!;
  return { ...view, root, viewport, track, thumb };
}

describe('滚动区', () => {
  it('内容未溢出时不显示滑块', () => {
    const { root, viewport, track } = renderArea();
    applyMetrics(viewport, { clientHeight: 400, scrollHeight: 400 });
    applyMetrics(track, { clientHeight: 300 });
    fireEvent.scroll(viewport);
    expect(root).toHaveAttribute('data-overflow', 'false');
  });

  it('溢出时按可视比例给出滑块长度与滚动位置', () => {
    const { root, viewport, track, thumb } = renderArea();
    applyMetrics(viewport, { clientHeight: 200, scrollHeight: 800 });
    applyMetrics(track, { clientHeight: 300 });

    fireEvent.scroll(viewport);
    expect(root).toHaveAttribute('data-overflow', 'true');
    expect(thumb).toHaveStyle({ height: '75px', transform: 'translateY(0px)' });

    applyMetrics(viewport, { clientHeight: 200, scrollHeight: 800, scrollTop: 300 });
    fireEvent.scroll(viewport);
    expect(thumb).toHaveStyle({ transform: 'translateY(112.5px)' });

    applyMetrics(viewport, { clientHeight: 200, scrollHeight: 800, scrollTop: 600 });
    fireEvent.scroll(viewport);
    expect(thumb).toHaveStyle({ transform: 'translateY(225px)' });
  });

  it('内容缩短到不再溢出时收起滑块', () => {
    const { root, viewport, track } = renderArea();
    applyMetrics(viewport, { clientHeight: 200, scrollHeight: 800 });
    applyMetrics(track, { clientHeight: 300 });
    fireEvent.scroll(viewport);
    expect(root).toHaveAttribute('data-overflow', 'true');

    applyMetrics(viewport, { clientHeight: 400, scrollHeight: 400 });
    fireEvent.scroll(viewport);
    expect(root).toHaveAttribute('data-overflow', 'false');
  });

  it('拖动滑块按比例更新滚动位置，拖动期间保持显示', () => {
    const { root, viewport, track, thumb } = renderArea();
    applyMetrics(viewport, { clientHeight: 200, scrollHeight: 800 });
    applyMetrics(track, { clientHeight: 300 });
    fireEvent.scroll(viewport);

    fireEvent.pointerDown(thumb, { clientY: 10, pointerId: 1 });
    expect(root).toHaveAttribute('data-dragging', 'true');
    // 轨道可移动距离 225px，内容可滚动 600px：下移 50px 约等于滚动 133px。
    fireEvent.pointerMove(thumb, { clientY: 60, pointerId: 1 });
    expect(viewport.scrollTop).toBeCloseTo(133.33, 1);
    fireEvent.pointerUp(thumb, { pointerId: 1 });
    expect(root).toHaveAttribute('data-dragging', 'false');
  });

  it('隐藏与语义交给外层容器和视口分别承担', () => {
    const { getByTestId } = render(
      <ScrollArea data-testid="viewport" role="tabpanel" aria-label="面板" tabIndex={0} hidden>
        <p>内容</p>
      </ScrollArea>,
    );
    const viewport = getByTestId('viewport');
    expect(viewport).toHaveAttribute('role', 'tabpanel');
    expect(viewport).toHaveAttribute('tabindex', '0');
    expect(viewport.parentElement).toHaveAttribute('hidden');
  });
});
