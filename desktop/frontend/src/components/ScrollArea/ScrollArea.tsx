import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

import styles from './ScrollArea.module.css';
import { SCROLLBAR_IDLE_MS } from './scrollbarActivity';

type ScrollAreaProps = Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'> & {
  /** 外层容器样式：负责尺寸与布局（flex/grid 项）。 */
  className?: string;
  /** 滚动视口样式：负责内边距、背景等原有排版。 */
  viewportClassName?: string;
  children: ReactNode;
  /** 仅在对应边缘还有隐藏内容时，以透明遮罩羽化内容；滚动轨道不参与遮罩。 */
  edgeFade?: boolean;
};

interface ThumbMetrics {
  height: number;
  offset: number;
}

interface DragState {
  pointerY: number;
  scrollTop: number;
  thumb: number;
}

/** 滑块最小长度，保证内容极长时仍可抓取。 */
const MIN_THUMB = 28;

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

/**
 * 自带滚动条的滚动容器：原生滚动条常驻占位但不可见，改由覆盖层滑块呈现，
 * 仅在窄槽悬停、滚动或拖动时淡入；焦点停留不常显，滚动停止后缓冲淡出。
 * 滑块、拖拽和边缘羽化共享同一组视口/轨道度量，在此统一更新以避免滚动时状态错位。
 */
export function ScrollArea({
  className,
  viewportClassName,
  children,
  hidden,
  onScroll,
  edgeFade = false,
  ...rest
}: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [thumb, setThumb] = useState<ThumbMetrics>({ height: 0, offset: 0 });
  const [scrollable, setScrollable] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const idle = useRef<ReturnType<typeof setTimeout>>();
  const activity = () => {
    clearTimeout(idle.current);
    setScrolling(true);
    idle.current = setTimeout(() => setScrolling(false), SCROLLBAR_IDLE_MS);
  };
  useEffect(() => () => clearTimeout(idle.current), []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const { clientHeight, scrollHeight, scrollTop } = viewport;
    const trackHeight = track.clientHeight;
    const range = scrollHeight - clientHeight;
    if (edgeFade) {
      const top = range > 1 && scrollTop > 1;
      const bottom = range > 1 && scrollTop < range - 1;
      setEdges((previous) =>
        previous.top === top && previous.bottom === bottom ? previous : { top, bottom },
      );
    }
    // 轨道高度为 0 表示容器尚未布局（面板隐藏或首帧），保持上一次结果。
    if (trackHeight <= 0) return;
    if (range <= 1) {
      setScrollable(false);
      return;
    }
    const height = Math.max(
      MIN_THUMB,
      Math.min(trackHeight, (clientHeight / scrollHeight) * trackHeight),
    );
    const maxOffset = trackHeight - height;
    const offset = Math.min(maxOffset, Math.max(0, (scrollTop / range) * maxOffset));
    setScrollable(true);
    setThumb((previous) =>
      Math.abs(previous.height - height) < 0.5 && Math.abs(previous.offset - offset) < 0.5
        ? previous
        : { height, offset },
    );
  }, [edgeFade]);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    // 观察内容尺寸变化，避免切换语言或数据更新后滑块比例失真。
    for (const child of Array.from(viewport.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, hidden]);

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !scrollable || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      pointerY: event.clientY,
      scrollTop: viewport.scrollTop,
      thumb: thumb.height,
    };
    setDragging(true);
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handleThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    const viewport = viewportRef.current;
    const trackHeight = trackRef.current?.clientHeight ?? 0;
    if (!state || !viewport) return;
    const maxOffset = trackHeight - state.thumb;
    const range = viewport.scrollHeight - viewport.clientHeight;
    if (maxOffset <= 0 || range <= 0) return;
    viewport.scrollTop = state.scrollTop + ((event.clientY - state.pointerY) / maxOffset) * range;
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    activity();
    if (
      typeof event.currentTarget.releasePointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture?.(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={joinClassNames(styles.root, className)}
      data-overflow={scrollable ? 'true' : 'false'}
      data-dragging={dragging ? 'true' : 'false'}
      data-scrolling={scrolling ? 'true' : 'false'}
      data-edge-fade={edgeFade ? 'true' : undefined}
      data-fade-top={edgeFade ? String(edges.top) : undefined}
      data-fade-bottom={edgeFade ? String(edges.bottom) : undefined}
      hidden={hidden}
    >
      <div
        ref={viewportRef}
        data-custom-scrollbar=""
        className={joinClassNames(styles.viewport, viewportClassName)}
        onScroll={(event) => {
          measure();
          activity();
          onScroll?.(event);
        }}
        {...rest}
      >
        {children}
      </div>
      <div ref={trackRef} className={styles.track} data-scrollbar-track="" aria-hidden="true">
        <div
          className={styles.thumb}
          data-scrollbar-thumb=""
          style={{ height: `${thumb.height}px`, transform: `translateY(${thumb.offset}px)` }}
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        />
      </div>
    </div>
  );
}
