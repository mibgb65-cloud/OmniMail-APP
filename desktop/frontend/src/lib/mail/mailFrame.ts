function isElement(target: EventTarget | null): target is Element {
  return (
    target !== null &&
    'nodeType' in target &&
    target.nodeType === 1 &&
    'closest' in target &&
    typeof target.closest === 'function'
  );
}

export function attachMailFrame(
  frame: HTMLIFrameElement,
  openLink: (url: string) => void,
  imageFailed: () => void = () => {},
  layoutReady: (layout: { oversized: boolean; scale: number }) => void = () => {},
) {
  const doc = frame.contentDocument;
  if (!doc?.body) return () => {};
  // 只同步受控主题属性，不重建 srcDoc，不重新请求图片，也不改变邮件原始数据。
  const theme = () => {
    doc.documentElement.dataset.mailTheme =
      frame.ownerDocument.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    doc.documentElement.dataset.mailOriginal = frame.dataset.original === 'true' ? 'true' : 'false';
  };
  theme();
  const themeObserver = new MutationObserver(theme);
  themeObserver.observe(frame.ownerDocument.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  themeObserver.observe(frame, { attributes: true, attributeFilter: ['data-original'] });
  const content = doc.getElementById('omnimail-content') ?? doc.body;
  let lastWidth = frame.clientWidth;
  const resize = () => {
    // 从未缩放的自然尺寸测量，固定宽邮件整体缩放而非横向裁切；正常长内容交给外层滚动。
    const available = Math.max(1, (frame.clientWidth || doc.documentElement.clientWidth) - 32);
    content.style.width = '';
    content.style.transform = '';
    const naturalWidth = Math.max(available, content.scrollWidth);
    const scale = Math.min(1, available / naturalWidth);
    const height = Math.ceil(content.scrollHeight * scale) + 32;
    const oversized = naturalWidth > 12000 || height > 32000;
    content.style.transformOrigin = 'top left';
    content.style.transform = `scale(${scale})`;
    const wrapper = doc.getElementById('omnimail-layout');
    if (wrapper) wrapper.style.height = `${height}px`;
    frame.style.height = `${(oversized ? 180 : Math.max(180, height)) + frame.clientTop * 2}px`;
    layoutReady({ oversized, scale });
  };
  const click = (event: Event) => {
    const target = event.target;
    // iframe 使用自己的 Window；不用父窗口 instanceof 判断跨文档节点。
    const link = isElement(target) ? target.closest('a') : null;
    if (!link) return;
    event.preventDefault();
    const url = link.getAttribute('data-mail-url');
    if (url) openLink(url);
  };
  const error = (event: Event) => {
    if (isElement(event.target) && event.target.tagName === 'IMG') imageFailed();
  };
  const key = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.shiftKey && event.key !== ' ') return;
    const reader = frame.closest<HTMLElement>('[data-mail-reader]');
    if (!reader || frame.ownerDocument.querySelector('dialog[open]')) return;
    let top = reader.scrollTop;
    const page = Math.max(40, reader.clientHeight * 0.85);
    if (event.key === 'PageDown') top += page;
    else if (event.key === 'PageUp') top -= page;
    else if (event.key === 'ArrowDown') top += 40;
    else if (event.key === 'ArrowUp') top -= 40;
    else if (event.key === 'Home') top = 0;
    else if (event.key === 'End') top = reader.scrollHeight - reader.clientHeight;
    else if (event.key === ' ') top += event.shiftKey ? -page : page;
    else return;
    event.preventDefault();
    reader.scrollTop = Math.max(0, Math.min(top, reader.scrollHeight - reader.clientHeight));
  };
  doc.addEventListener('click', click);
  doc.addEventListener('auxclick', click);
  doc.addEventListener('load', resize, true);
  doc.addEventListener('error', error, true);
  doc.addEventListener('keydown', key);
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver((entries) => {
          if (
            entries.some((entry) => entry.target === content) ||
            frame.clientWidth !== lastWidth
          ) {
            lastWidth = frame.clientWidth;
            resize();
          }
        });
  observer?.observe(content);
  observer?.observe(frame);
  if (
    [...doc.images].some(
      (image) => image.hasAttribute('src') && image.complete && image.naturalWidth === 0,
    )
  )
    imageFailed();
  resize();
  return () => {
    themeObserver.disconnect();
    observer?.disconnect();
    doc.removeEventListener('click', click);
    doc.removeEventListener('auxclick', click);
    doc.removeEventListener('load', resize, true);
    doc.removeEventListener('error', error, true);
    doc.removeEventListener('keydown', key);
  };
}
