import {
  computeOverlayScrollbar,
  computeScrollTopForThumbDelta,
  computeScrollTopForTrackClick,
  OVERLAY_SCROLLBAR_TRACK_INSET,
} from "./scrollFade";

const AUTO_HIDE_DELAY_MS = 900;

interface DragSession {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  maxOffset: number;
  maxScrollTop: number;
}

export function attachOverlayScrollbarInteraction(
  host: HTMLElement,
  viewport: HTMLElement,
  track: HTMLElement,
  thumb: HTMLElement,
) {
  let hideTimer: number | null = null;
  let hovered = false;
  let drag: DragSession | null = null;

  const clearHideTimer = () => {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const setVisible = (visible: boolean) => {
    if (visible) {
      host.setAttribute("data-scrollbar-visible", "true");
    } else {
      host.removeAttribute("data-scrollbar-visible");
    }
  };

  const scheduleHide = () => {
    clearHideTimer();
    if (hovered || drag) return;
    hideTimer = window.setTimeout(() => {
      hideTimer = null;
      if (!hovered && !drag) setVisible(false);
    }, AUTO_HIDE_DELAY_MS);
  };

  const notifyScrollActivity = () => {
    if (!host.hasAttribute("data-scrollable")) return;
    setVisible(true);
    scheduleHide();
  };

  const endDrag = () => {
    if (!drag) return;
    drag = null;
    host.removeAttribute("data-scrollbar-dragging");
    document.documentElement.classList.remove("fade-scroll-dragging");
    scheduleHide();
  };

  const onTrackEnter = () => {
    hovered = true;
    clearHideTimer();
    if (host.hasAttribute("data-scrollable")) {
      setVisible(true);
    }
  };

  const onTrackLeave = () => {
    hovered = false;
    scheduleHide();
  };

  const getTrackHeight = () =>
    track.clientHeight ||
    Math.max(0, viewport.clientHeight - OVERLAY_SCROLLBAR_TRACK_INSET * 2);

  const onThumbPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const geom = computeOverlayScrollbar(viewport, getTrackHeight());
    if (!geom.scrollable || geom.maxOffset <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    clearHideTimer();
    setVisible(true);
    host.setAttribute("data-scrollbar-dragging", "true");
    document.documentElement.classList.add("fade-scroll-dragging");
    thumb.setPointerCapture?.(e.pointerId);
    drag = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startScrollTop: viewport.scrollTop,
      maxOffset: geom.maxOffset,
      maxScrollTop: geom.maxScrollTop,
    };
  };

  const onThumbPointerMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    viewport.scrollTop = computeScrollTopForThumbDelta(
      drag.startScrollTop,
      e.clientY - drag.startY,
      drag.maxOffset,
      drag.maxScrollTop,
    );
  };

  const onThumbPointerUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (thumb.hasPointerCapture?.(e.pointerId)) {
      thumb.releasePointerCapture?.(e.pointerId);
    }
    endDrag();
  };

  const onTrackPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || e.target !== track) return;
    const trackHeight = getTrackHeight();
    const geom = computeOverlayScrollbar(viewport, trackHeight);
    if (!geom.scrollable) return;
    e.preventDefault();
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    viewport.scrollTop = computeScrollTopForTrackClick(
      clickY,
      trackHeight,
      geom.thumbHeight,
      geom.maxScrollTop,
    );
    notifyScrollActivity();
  };

  track.addEventListener("pointerenter", onTrackEnter);
  track.addEventListener("pointerleave", onTrackLeave);
  track.addEventListener("pointerdown", onTrackPointerDown);
  thumb.addEventListener("pointerdown", onThumbPointerDown);
  thumb.addEventListener("pointermove", onThumbPointerMove);
  thumb.addEventListener("pointerup", onThumbPointerUp);
  thumb.addEventListener("pointercancel", onThumbPointerUp);

  return {
    notifyScrollActivity,
    dispose() {
      clearHideTimer();
      endDrag();
      setVisible(false);
      track.removeEventListener("pointerenter", onTrackEnter);
      track.removeEventListener("pointerleave", onTrackLeave);
      track.removeEventListener("pointerdown", onTrackPointerDown);
      thumb.removeEventListener("pointerdown", onThumbPointerDown);
      thumb.removeEventListener("pointermove", onThumbPointerMove);
      thumb.removeEventListener("pointerup", onThumbPointerUp);
      thumb.removeEventListener("pointercancel", onThumbPointerUp);
    },
  };
}
