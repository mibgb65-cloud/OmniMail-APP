/** 用布局尺寸而不是整个 :hover 区域命中原生滚动槽；边框、正文、缩放和 RTL 均独立处理。 */
export function isScrollbarGutterHit(node: HTMLElement, clientX: number, clientY: number) {
  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || node.offsetWidth <= 0 || node.offsetHeight <= 0)
    return false;
  const x = ((clientX - rect.left) * node.offsetWidth) / rect.width;
  const y = ((clientY - rect.top) * node.offsetHeight) / rect.height;
  const style = node.ownerDocument.defaultView?.getComputedStyle(node);
  const left = Number.parseFloat(style?.borderLeftWidth ?? '') || 0;
  const right = node.offsetWidth - (Number.parseFloat(style?.borderRightWidth ?? '') || 0);
  const top = Number.parseFloat(style?.borderTopWidth ?? '') || 0;
  const bottom = node.offsetHeight - (Number.parseFloat(style?.borderBottomWidth ?? '') || 0);
  const contentLeft = node.clientLeft,
    contentTop = node.clientTop;
  const contentRight = contentLeft + node.clientWidth,
    contentBottom = contentTop + node.clientHeight;
  const vertical =
    node.scrollHeight > node.clientHeight + 1 &&
    y >= contentTop &&
    y < contentBottom &&
    ((x >= left && x < contentLeft) || (x >= contentRight && x < right));
  const horizontal =
    node.scrollWidth > node.clientWidth + 1 &&
    x >= contentLeft &&
    x < contentRight &&
    ((y >= top && y < contentTop) || (y >= contentBottom && y < bottom));
  return vertical || horizontal;
}
