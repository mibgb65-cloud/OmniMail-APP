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
) {
  const doc = frame.contentDocument;
  if (!doc?.body) return () => {};
  const resize = () => {
    // 超长内容仍可在 iframe 内滚动，不允许不可信布局申请无限像素高度。
    frame.style.height = `${Math.min(32000, Math.max(180, doc.body.scrollHeight + 32))}px`;
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
  doc.addEventListener('click', click);
  doc.addEventListener('auxclick', click);
  doc.addEventListener('load', resize, true);
  doc.addEventListener('error', error, true);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
  observer?.observe(doc.body);
  if (
    [...doc.images].some(
      (image) => image.hasAttribute('src') && image.complete && image.naturalWidth === 0,
    )
  )
    imageFailed();
  resize();
  return () => {
    observer?.disconnect();
    doc.removeEventListener('click', click);
    doc.removeEventListener('auxclick', click);
    doc.removeEventListener('load', resize, true);
    doc.removeEventListener('error', error, true);
  };
}
