import { expect, it, vi } from 'vitest';
import { revealMailPage } from './mailReveal';

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
