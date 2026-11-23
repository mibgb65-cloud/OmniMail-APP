const edgeTolerance = 2;

export function readScrollFade(
  metrics: Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">,
) {
  const remaining = metrics.scrollHeight - metrics.clientHeight;
  const scrollable = metrics.clientHeight > 0 && remaining > edgeTolerance;
  return {
    scrollable,
    hasMore:
      scrollable && remaining - Math.max(0, metrics.scrollTop) > edgeTolerance,
  };
}

export function attachScrollFade(
  host: HTMLElement,
  viewport: HTMLElement,
  options: {
    content?: HTMLElement;
    focusOnOverflow?: boolean;
    editable?: boolean;
  },
) {
  let frame: number | null = null;
  const measure = () => {
    const { scrollable, hasMore } = readScrollFade(viewport);
    host.toggleAttribute("data-scroll-more", hasMore);
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

  const observer = new ResizeObserver(refresh);
  observer.observe(viewport);
  if (options.content) observer.observe(options.content);
  viewport.addEventListener("scroll", refresh, { passive: true });
  if (options.editable) viewport.addEventListener("input", refresh);
  measure();

  return {
    refresh,
    dispose() {
      observer.disconnect();
      viewport.removeEventListener("scroll", refresh);
      if (options.editable) viewport.removeEventListener("input", refresh);
      if (frame !== null) window.cancelAnimationFrame(frame);
      host.removeAttribute("data-scroll-more");
    },
  };
}
