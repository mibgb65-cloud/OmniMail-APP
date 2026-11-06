import { expect, it } from 'vitest';
import { isScrollbarGutterHit } from './scrollbarHitTest';

function viewport({ rtl = false, scale = 1, horizontal = false, overflow = true } = {}) {
  const node = document.createElement('div');
  node.style.border = '1px solid black';
  document.body.append(node);
  Object.defineProperties(node, {
    offsetWidth: { value: 220 },
    offsetHeight: { value: 160 },
    clientLeft: { value: rtl ? 13 : 1 },
    clientTop: { value: 1 },
    clientWidth: { value: 206 },
    clientHeight: { value: horizontal ? 146 : 158 },
    scrollWidth: { value: horizontal ? 600 : 206 },
    scrollHeight: { value: overflow ? 600 : horizontal ? 146 : 158 },
  });
  node.getBoundingClientRect = () => new DOMRect(10, 20, 220 * scale, 160 * scale);
  return node;
}
it('仅命中预留的滚动条槽，正文、边框及元素外不命中', () => {
  const node = viewport();
  expect(isScrollbarGutterHit(node, 220, 80)).toBe(true);
  expect(isScrollbarGutterHit(node, 80, 80)).toBe(false);
  expect(isScrollbarGutterHit(node, 229.5, 80)).toBe(false);
  expect(isScrollbarGutterHit(node, 220, 20.5)).toBe(false);
  expect(isScrollbarGutterHit(node, 235, 80)).toBe(false);
});
it('支持 RTL 左侧滚动条以及变换后的坐标，不假定滚动条始终位于右侧', () => {
  const rtl = viewport({ rtl: true });
  expect(isScrollbarGutterHit(rtl, 15, 80)).toBe(true);
  expect(isScrollbarGutterHit(rtl, 225, 80)).toBe(false);
  const scaled = viewport({ scale: 2 });
  expect(isScrollbarGutterHit(scaled, 430, 80)).toBe(true);
  expect(isScrollbarGutterHit(scaled, 110, 80)).toBe(false);
});
it('水平滚动槽按底部位置判断，无溢出时预留槽也不触发显示', () => {
  const horizontal = viewport({ horizontal: true });
  expect(isScrollbarGutterHit(horizontal, 80, 172)).toBe(true);
  expect(isScrollbarGutterHit(horizontal, 80, 100)).toBe(false);
  expect(isScrollbarGutterHit(viewport({ overflow: false }), 220, 80)).toBe(false);
});
