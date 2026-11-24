const edgeTolerance = 2;

export const MIN_SCROLL_THUMB_HEIGHT = 28;
export const OVERLAY_SCROLLBAR_TRACK_INSET = 4;

export type ScrollMetrics = Pick<
  HTMLElement,
  "clientHeight" | "scrollHeight" | "scrollTop"
>;

export interface OverlayScrollbarGeometry {
  scrollable: boolean;
  thumbHeight: number;
  thumbOffset: number;
  maxScrollTop: number;
  maxOffset: number;
}

export function readScrollFade(metrics: ScrollMetrics) {
  const remaining = metrics.scrollHeight - metrics.clientHeight;
  const scrollable = metrics.clientHeight > 0 && remaining > edgeTolerance;
  return {
    scrollable,
    hasMore:
      scrollable && remaining - Math.max(0, metrics.scrollTop) > edgeTolerance,
  };
}

/**
 * 基于容器视口尺寸、总内容高度与轨道高度计算悬浮滑块高度及 Y 轴偏移。
 * 未溢出时返回 scrollable=false 且滑块高度为 0；超长列表钳制滑块最小高度为 28px。
 */
export function computeOverlayScrollbar(
  metrics: ScrollMetrics,
  trackHeight: number,
  minThumbHeight = MIN_SCROLL_THUMB_HEIGHT,
): OverlayScrollbarGeometry {
  const { scrollable } = readScrollFade(metrics);
  const maxScrollTop = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  const safeTrack = Math.max(0, trackHeight);
  if (!scrollable || safeTrack <= 0 || maxScrollTop <= 0) {
    return {
      scrollable: false,
      thumbHeight: 0,
      thumbOffset: 0,
      maxScrollTop: 0,
      maxOffset: 0,
    };
  }
  const ratio = metrics.clientHeight / metrics.scrollHeight;
  const rawThumb = Math.round(safeTrack * ratio);
  const clampedMin = Math.min(minThumbHeight, safeTrack);
  const thumbHeight = Math.min(safeTrack, Math.max(clampedMin, rawThumb));
  const maxOffset = Math.max(0, safeTrack - thumbHeight);
  const clampedScrollTop = Math.min(
    maxScrollTop,
    Math.max(0, metrics.scrollTop),
  );
  const progress = clampedScrollTop / maxScrollTop;
  const thumbOffset = Math.round(progress * maxOffset * 100) / 100;
  return {
    scrollable: true,
    thumbHeight,
    thumbOffset,
    maxScrollTop,
    maxOffset,
  };
}

export function computeScrollTopForThumbDelta(
  startScrollTop: number,
  deltaY: number,
  maxOffset: number,
  maxScrollTop: number,
): number {
  if (maxOffset <= 0 || maxScrollTop <= 0) return 0;
  const next = startScrollTop + (deltaY / maxOffset) * maxScrollTop;
  return Math.min(maxScrollTop, Math.max(0, next));
}

export function computeScrollTopForTrackClick(
  clickY: number,
  trackHeight: number,
  thumbHeight: number,
  maxScrollTop: number,
): number {
  const maxOffset = Math.max(0, trackHeight - thumbHeight);
  if (maxOffset <= 0 || maxScrollTop <= 0) return 0;
  const targetOffset = Math.min(
    maxOffset,
    Math.max(0, clickY - thumbHeight / 2),
  );
  return (targetOffset / maxOffset) * maxScrollTop;
}

export function attachScrollFade(
  host: HTMLElement,
  viewport: HTMLElement,
  options: {
    content?: HTMLElement;
    track?: HTMLElement | null;
    thumb?: HTMLElement | null;
    focusOnOverflow?: boolean;
    editable?: boolean;
    onScrollActivity?: () => void;
  },
) {
  let frame: number | null = null;
  const measure = () => {
    const { scrollable, hasMore } = readScrollFade(viewport);
    host.toggleAttribute("data-scroll-more", hasMore);
    if (options.track && options.thumb) {
      host.toggleAttribute("data-scrollable", scrollable);
      const trackHeight =
        options.track.clientHeight ||
        Math.max(0, viewport.clientHeight - OVERLAY_SCROLLBAR_TRACK_INSET * 2);
      const geom = computeOverlayScrollbar(viewport, trackHeight);
      if (geom.scrollable) {
        options.thumb.style.height = `${geom.thumbHeight}px`;
        options.thumb.style.transform = `translate3d(0, ${geom.thumbOffset}px, 0)`;
      } else {
        options.thumb.style.height = "0px";
        options.thumb.style.transform = "translate3d(0, 0, 0)";
      }
    }
    if (options.focusOnOverflow) {
      const tabIndex = scrollable ? 0 : -1;
      if (viewport.tabIndex !== tabIndex) viewport.tabIndex = tabIndex;
    }
  };
  const refresh = () => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      measure();
    });
  };
  const onScroll = () => {
    options.onScrollActivity?.();
    refresh();
  };

  const observer = new ResizeObserver(refresh);
  observer.observe(viewport);
  if (options.content) observer.observe(options.content);
  viewport.addEventListener("scroll", onScroll, { passive: true });
  if (options.editable) viewport.addEventListener("input", refresh);
  measure();

  return {
    refresh,
    dispose() {
      observer.disconnect();
      viewport.removeEventListener("scroll", onScroll);
      if (options.editable) viewport.removeEventListener("input", refresh);
      if (frame !== null) window.cancelAnimationFrame(frame);
      host.removeAttribute("data-scroll-more");
      if (options.track && options.thumb) {
        host.removeAttribute("data-scrollable");
      }
    },
  };
}
