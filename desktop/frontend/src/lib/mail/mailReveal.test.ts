import { expect, it, vi } from 'vitest';
import { revealMailList, revealMailPage } from './mailReveal';

function fixture() {
  const page = document.createElement('div');
  page.innerHTML =
    '<h2 data-mail-reveal>标题</h2><div data-mail-reveal>邮件信息</div><div data-mail-reveal>正文</div>';
  document.body.append(page);
  const cancelled = vi.fn();
  const calls: { node: Element; options: KeyframeAnimationOptions }[] = [];
  [...page.children].forEach((node, index) => {
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, index * 50, 600, 30));
    Object.defineProperty(node, 'animate', {
      configurable: true,
      value: vi.fn((_frames, options: KeyframeAnimationOptions) => {
        calls.push({ node, options });
        return { cancel: cancelled };
      }),
    });
  });
  return { page, calls, cancelled };
}

it('按可视位置从上到下错峰入场，总时长有界，不改动文档布局', () => {
  const { page, calls, cancelled } = fixture();
  const markup = page.innerHTML;
  const close = revealMailPage(page);
  expect(calls.map((call) => call.node.textContent)).toEqual(['标题', '邮件信息', '正文']);
  expect(calls.map((call) => call.options.delay)).toEqual([0, 75, 150]);
  expect(
    calls.every((call) => Number(call.options.delay) + Number(call.options.duration) <= 760),
  ).toBe(true);
  expect(page.innerHTML).toBe(markup);
  close();
  expect(cancelled).toHaveBeenCalledTimes(3);
  page.remove();
});

it('减少动态不创建动画，没有动画能力仍直接可读', () => {
  const { page, calls } = fixture();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  revealMailPage(page)();
  expect(calls).toHaveLength(0);
  vi.unstubAllGlobals();
  page.remove();
  const plain = document.createElement('div');
  plain.innerHTML = '<p data-mail-reveal>无动画也能读</p>';
  expect(() => revealMailPage(plain)()).not.toThrow();
});

it('穿透单列表格外壳为正文分段，首屏动画数量有界且不修改表格或缩放', () => {
  const { page, calls, cancelled } = fixture();
  const frame = document.createElement('iframe');
  frame.dataset.mailFrame = 'safe';
  page.append(frame);
  const doc = frame.contentDocument;
  if (!doc) throw new Error('测试 iframe 缺失');
  doc.body.innerHTML =
    '<div id="omnimail-content" style="transform:scale(0.8)"><table><tbody><tr><td>' +
    Array.from({ length: 40 }, (_, i) => `<p>段落 ${i}</p>`).join('') +
    '</td></tr></tbody></table></div>';
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 150, 600, 1000));
  doc.querySelectorAll('p').forEach((node, index) => {
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, index * 40, 500, 30));
    Object.defineProperty(node, 'animate', {
      value: vi.fn((_frames, options: KeyframeAnimationOptions) => {
        calls.push({ node, options });
        return { cancel: cancelled };
      }),
    });
  });
  const original = doc.body.innerHTML;
  const close = revealMailPage(page);
  expect(calls).toHaveLength(18);
  expect(
    calls.every(
      (call, index) =>
        index === 0 || Number(call.options.delay) > Number(calls[index - 1]?.options.delay),
    ),
  ).toBe(true);
  expect(calls.slice(3, 6).map((call) => call.node.textContent)).toEqual([
    '段落 0',
    '段落 1',
    '段落 2',
  ]);
  expect(
    Number(calls.at(-1)?.options.delay) + Number(calls.at(-1)?.options.duration),
  ).toBeLessThanOrEqual(760);
  expect(doc.body.innerHTML).toBe(original);
  page.dispatchEvent(new FocusEvent('focusin'));
  expect(cancelled).toHaveBeenCalledTimes(18);
  close();
  page.remove();
});

it('列表只为视口内邮件行从上到下入场，滚动立即取消，清理后不再响应旧事件', () => {
  const viewport = document.createElement('div');
  viewport.dataset.customScrollbar = '';
  const list = document.createElement('ul');
  viewport.append(list);
  document.body.append(viewport);
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 320, 300));
  const calls: { text: string | null; delay: number }[] = [];
  const cancelled = vi.fn();
  [350, 120, 250, 500, 50].forEach((top, index) => {
    const row = document.createElement('li');
    row.dataset.mailReveal = '';
    row.textContent = `邮件 ${index}`;
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, top, 320, 40));
    Object.defineProperty(row, 'animate', {
      value: vi.fn((_frames, options: KeyframeAnimationOptions) => {
        calls.push({ text: row.textContent, delay: Number(options.delay) });
        return { cancel: cancelled };
      }),
    });
    list.append(row);
  });
  const close = revealMailList(list);
  expect(calls).toEqual([
    { text: '邮件 1', delay: 0 },
    { text: '邮件 2', delay: 75 },
    { text: '邮件 0', delay: 150 },
  ]);
  viewport.dispatchEvent(new Event('scroll'));
  expect(cancelled).toHaveBeenCalledTimes(3);
  close();
  expect(cancelled).toHaveBeenCalledTimes(6);
  viewport.dispatchEvent(new Event('scroll'));
  viewport.dispatchEvent(new Event('pointerdown'));
  expect(cancelled).toHaveBeenCalledTimes(6);
  viewport.remove();
});
