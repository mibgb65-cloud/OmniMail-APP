const BLOCK_TAGS = /^(P|H[1-6]|UL|OL|PRE|IMG|HR)$/;
const LAYOUT_TAGS = /^(DIV|TABLE|TBODY|THEAD|TFOOT|TR|TD|TH|CENTER|BLOCKQUOTE)$/;
const MAX_PARTS = 18;

function bodyParts(root: Element): Element[] {
  const parts: Element[] = [];
  let visited = 0;
  const visit = (node: Element, depth: number) => {
    if (++visited > 160 || depth > 16 || parts.length >= MAX_PARTS) return;
    const children = [...node.children];
    // 多列表格行整体入场；单列布局表格只穿过外壳，不重排/拆开邮件表格。
    if (
      BLOCK_TAGS.test(node.tagName) ||
      (node.tagName === 'TR' && children.length > 1) ||
      !children.length ||
      !LAYOUT_TAGS.test(node.tagName)
    ) {
      if (node.textContent?.trim() || node.tagName === 'IMG' || node.tagName === 'HR')
        parts.push(node);
    } else children.forEach((child) => visit(child, depth + 1));
  };
  [...root.children].forEach((child) => visit(child, 0));
  return parts;
}

export function revealMailPage(page: HTMLElement) {
  const media = page.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (media?.matches) return () => {};
  const reader = page.closest<HTMLElement>('[data-mail-reader]');
  const bottom = reader?.getBoundingClientRect().bottom ?? Infinity;
  const candidates: { node: Element; top: number }[] = [
    ...page.querySelectorAll<HTMLElement>('[data-mail-reveal]'),
  ]
    .slice(0, 80)
    .map((node) => ({ node, top: node.getBoundingClientRect().top }));
  const frame = page.querySelector<HTMLIFrameElement>('iframe[data-mail-frame="safe"]');
  const frameDocument = frame?.contentDocument;
  const content = frameDocument?.getElementById('omnimail-content');
  if (frame && content) {
    const top = frame.getBoundingClientRect().top + frame.clientTop;
    const parts = bodyParts(content);
    candidates.push(
      ...parts.map((node) => ({ node, top: top + node.getBoundingClientRect().top })),
    );
    if (!parts.length && content.textContent?.trim()) candidates.push({ node: frame, top });
  }
  const targets = candidates
    .filter(
      ({ node, top }) =>
        node.getBoundingClientRect().height > 0 &&
        top < bottom &&
        typeof node.animate === 'function',
    )
    .sort((a, b) => a.top - b.top)
    .slice(0, MAX_PARTS);
  const stagger = Math.min(75, 420 / Math.max(1, targets.length - 1));
  const animations = targets.map(({ node }, index) =>
    node.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: 320,
        delay: Math.round(index * stagger),
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'backwards',
      },
    ),
  );
  // 动画不决定可读状态；快切、减少动态或键盘聚焦都能直接取消并显示最终样式。
  const cancel = () => animations.forEach((animation) => animation.cancel());
  page.addEventListener('focusin', cancel);
  frameDocument?.addEventListener('focusin', cancel);
  media?.addEventListener?.('change', cancel);
  return () => {
    cancel();
    page.removeEventListener('focusin', cancel);
    frameDocument?.removeEventListener('focusin', cancel);
    media?.removeEventListener?.('change', cancel);
  };
}
