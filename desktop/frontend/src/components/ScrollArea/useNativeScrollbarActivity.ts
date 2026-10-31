import { useEffect } from 'react';
import { SCROLLBAR_IDLE_MS } from './scrollbarActivity';
import { isScrollbarGutterHit } from './scrollbarHitTest';

/** 捕获真实滚动，不接管滚轮/键盘事件，也不改变既有组件的 onScroll 或滚动位置。 */
export function observeNativeScrollbarActivity(root: Document) {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  let hovered: HTMLElement | null = null;
  const setHovered = (next: HTMLElement | null) => {
    if (hovered === next) return;
    hovered?.removeAttribute('data-scrollbar-hover');
    hovered = next;
    hovered?.setAttribute('data-scrollbar-hover', 'true');
  };
  const clearHover = () => setHovered(null);
  const move = (event: PointerEvent) => {
    let candidate =
      event.pointerType !== 'touch' && event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-native-scrollbar], textarea')
        : null;
    while (candidate) {
      if (isScrollbarGutterHit(candidate, event.clientX, event.clientY)) break;
      candidate =
        candidate.parentElement?.closest<HTMLElement>('[data-native-scrollbar], textarea') ?? null;
    }
    setHovered(candidate);
  };
  const leave = (event: PointerEvent) => {
    // 离开浏览器或进入 iframe 时，后续指针移动不一定回到本 document，必须撤销旧命中。
    if (event.relatedTarget === null) clearHover();
  };
  const scroll = (event: Event) => {
    const target = event.target;
    if (
      !(target instanceof Element) ||
      !target.matches('[data-native-scrollbar], textarea') ||
      target.hasAttribute('data-custom-scrollbar')
    )
      return;
    clearTimeout(timers.get(target));
    if (
      target.scrollHeight <= target.clientHeight + 1 &&
      target.scrollWidth <= target.clientWidth + 1
    ) {
      timers.delete(target);
      target.removeAttribute('data-scrolling');
      return;
    }
    if (target.getAttribute('data-scrolling') !== 'true')
      target.setAttribute('data-scrolling', 'true');
    timers.set(
      target,
      setTimeout(() => {
        target.removeAttribute('data-scrolling');
        timers.delete(target);
      }, SCROLLBAR_IDLE_MS),
    );
  };
  root.addEventListener('scroll', scroll, { capture: true, passive: true });
  root.addEventListener('pointermove', move, { capture: true, passive: true });
  root.addEventListener('pointerover', move, { capture: true, passive: true });
  root.addEventListener('pointerout', leave, { capture: true, passive: true });
  root.defaultView?.addEventListener('blur', clearHover);
  root.defaultView?.addEventListener('resize', clearHover);
  return () => {
    root.removeEventListener('scroll', scroll, true);
    root.removeEventListener('pointermove', move, true);
    root.removeEventListener('pointerover', move, true);
    root.removeEventListener('pointerout', leave, true);
    root.defaultView?.removeEventListener('blur', clearHover);
    root.defaultView?.removeEventListener('resize', clearHover);
    clearHover();
    for (const [target, timer] of timers) {
      clearTimeout(timer);
      target.removeAttribute('data-scrolling');
    }
    timers.clear();
  };
}

export function useNativeScrollbarActivity() {
  useEffect(() => observeNativeScrollbarActivity(document), []);
}
