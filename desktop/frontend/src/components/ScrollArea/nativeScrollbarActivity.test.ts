import { fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { observeNativeScrollbarActivity } from './useNativeScrollbarActivity';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
function scroller(custom = false) {
  const element = document.createElement('div');
  element.style.border = '1px solid black';
  if (custom) element.setAttribute('data-custom-scrollbar', '');
  else element.setAttribute('data-native-scrollbar', '');
  Object.defineProperties(element, {
    offsetWidth: { value: 114 },
    offsetHeight: { value: 102 },
    clientLeft: { value: 1 },
    clientTop: { value: 1 },
    clientHeight: { value: 100 },
    scrollHeight: { value: 400 },
    clientWidth: { value: 100 },
    scrollWidth: { value: 100 },
  });
  element.getBoundingClientRect = () => new DOMRect(10, 20, 114, 102);
  document.body.append(element);
  return element;
}
it('原生监听仅标记实际滚动容器，不串到嵌套父区域，不阻止业务滚动事件', () => {
  vi.useFakeTimers();
  const parent = scroller(),
    child = scroller();
  parent.append(child);
  const business = vi.fn();
  child.addEventListener('scroll', business);
  const dispose = observeNativeScrollbarActivity(document);
  fireEvent.scroll(child);
  expect(child).toHaveAttribute('data-scrolling', 'true');
  expect(parent).not.toHaveAttribute('data-scrolling');
  expect(business).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(600);
  fireEvent.scroll(child);
  vi.advanceTimersByTime(600);
  expect(child).toHaveAttribute('data-scrolling', 'true');
  vi.advanceTimersByTime(201);
  expect(child).not.toHaveAttribute('data-scrolling');
  dispose();
});

it('只有鼠标进入窄槽才命中，内容/触控/窗口失焦/离开与卸载均会清理悬浮', () => {
  const node = scroller();
  const child = document.createElement('p');
  node.append(child);
  const dispose = observeNativeScrollbarActivity(document);
  fireEvent.pointerMove(child, { clientX: 50, clientY: 60, pointerType: 'mouse' });
  expect(node).not.toHaveAttribute('data-scrollbar-hover');
  fireEvent.pointerMove(node, { clientX: 120, clientY: 60, pointerType: 'mouse' });
  expect(node).toHaveAttribute('data-scrollbar-hover', 'true');
  fireEvent.pointerMove(child, { clientX: 50, clientY: 60, pointerType: 'mouse' });
  expect(node).not.toHaveAttribute('data-scrollbar-hover');
  fireEvent.pointerOver(node, { clientX: 120, clientY: 60, pointerType: 'touch' });
  expect(node).not.toHaveAttribute('data-scrollbar-hover');
  fireEvent.pointerMove(node, { clientX: 120, clientY: 60, pointerType: 'mouse' });
  fireEvent.blur(window);
  expect(node).not.toHaveAttribute('data-scrollbar-hover');
  fireEvent.pointerMove(node, { clientX: 120, clientY: 60, pointerType: 'mouse' });
  fireEvent.resize(window);
  expect(node).not.toHaveAttribute('data-scrollbar-hover');
  fireEvent.pointerMove(node, { clientX: 120, clientY: 60, pointerType: 'mouse' });
  fireEvent.pointerOut(node, { relatedTarget: null });
  expect(node).not.toHaveAttribute('data-scrollbar-hover');
  fireEvent.pointerMove(node, { clientX: 120, clientY: 60, pointerType: 'mouse' });
  dispose();
  expect(node).not.toHaveAttribute('data-scrollbar-hover');
});
it('不重复接管自定义视口，卸载原生监听后清除属性和定时器', () => {
  vi.useFakeTimers();
  const native = scroller(),
    custom = scroller(true);
  const dispose = observeNativeScrollbarActivity(document);
  fireEvent.scroll(custom);
  expect(custom).not.toHaveAttribute('data-scrolling');
  fireEvent.scroll(native);
  expect(native).toHaveAttribute('data-scrolling', 'true');
  dispose();
  expect(native).not.toHaveAttribute('data-scrolling');
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.scroll(native);
  expect(native).not.toHaveAttribute('data-scrolling');
});
