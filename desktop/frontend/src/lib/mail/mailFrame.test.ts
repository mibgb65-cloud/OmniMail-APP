import { fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { attachMailFrame } from './mailFrame';

function fixture(width: number, contentWidth: number, height: number) {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  Object.defineProperty(frame, 'clientWidth', { configurable: true, value: width });
  const doc = frame.contentDocument;
  if (!doc) throw new Error('测试文档缺失');
  doc.body.innerHTML = '<div id="omnimail-content"><table><tr><td>全部内容</td></tr></table></div>';
  const content = doc.getElementById('omnimail-content');
  if (!content) throw new Error('正文包装缺失');
  Object.defineProperties(content, {
    scrollWidth: { configurable: true, value: contentWidth },
    scrollHeight: { configurable: true, value: height },
  });
  return { frame, content };
}

it('正文主题跟随应用，原始配色无需重载或修改图片，卸载后停止同步', async () => {
  const { frame } = fixture(352, 320, 800);
  const root = frame.contentDocument?.documentElement;
  document.documentElement.dataset.theme = 'dark';
  const close = attachMailFrame(frame, vi.fn());
  expect(root?.dataset.mailTheme).toBe('dark');
  frame.dataset.original = 'true';
  await Promise.resolve();
  expect(root?.dataset.mailOriginal).toBe('true');
  document.documentElement.dataset.theme = 'light';
  await Promise.resolve();
  expect(root?.dataset.mailTheme).toBe('light');
  close();
  document.documentElement.dataset.theme = 'dark';
  await Promise.resolve();
  expect(root?.dataset.mailTheme).toBe('light');
  frame.remove();
  delete document.documentElement.dataset.theme;
});

it('固定宽邮件等比适应可用宽度，完整高度交外层滚动而非裁掉正文', () => {
  const { frame, content } = fixture(352, 640, 800);
  const layout = vi.fn();
  const close = attachMailFrame(frame, vi.fn(), vi.fn(), layout);
  expect(content.style.transform).toBe('scale(0.5)');
  expect(frame.style.height).toBe('432px');
  expect(layout).toHaveBeenLastCalledWith(
    expect.objectContaining({ oversized: false, scale: 0.5 }),
  );
  close();
  frame.remove();
});

it('极端高度必须通知降级，不静默截断，卸载后清理监听', () => {
  const { frame } = fixture(672, 640, 50000);
  const layout = vi.fn();
  const close = attachMailFrame(frame, vi.fn(), vi.fn(), layout);
  expect(layout).toHaveBeenCalledWith(expect.objectContaining({ oversized: true }));
  close();
  layout.mockClear();
  fireEvent.load(frame);
  expect(layout).not.toHaveBeenCalled();
  frame.remove();
});
it('邮件内键盘阅读滚动外层，Tab/Enter 和带修饰键的快捷键保持原行为', () => {
  const reader = document.createElement('section');
  reader.setAttribute('data-mail-reader', '');
  document.body.append(reader);
  Object.defineProperties(reader, { clientHeight: { value: 400 }, scrollHeight: { value: 1200 } });
  const { frame } = fixture(352, 320, 800);
  reader.append(frame);
  const doc = frame.contentDocument;
  if (!doc) throw new Error('测试文档缺失');
  const close = attachMailFrame(frame, vi.fn());
  const next = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
  doc.body.dispatchEvent(next);
  expect(next.defaultPrevented).toBe(true);
  expect(reader.scrollTop).toBe(340);
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  doc.body.dispatchEvent(enter);
  expect(enter.defaultPrevented).toBe(false);
  const select = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  doc.body.dispatchEvent(select);
  expect(select.defaultPrevented).toBe(false);
  close();
  reader.remove();
});
