import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

import styles from './ScrollArea.module.css';

type ScrollAreaProps = Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'> & {
  /** 外层容器样式：负责尺寸与布局（flex/grid 项）。 */
  className?: string;
  /** 滚动视口样式：负责内边距、背景等原有排版。 */
  viewportClassName?: string;
  children: ReactNode;
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
 * 仅在指针悬停、焦点进入或拖动时淡入，离开后淡出。
 */
export function ScrollArea({
  className,
  viewportClassName,
  children,
  hidden,
  onScroll,
  ...rest
}: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [thumb, setThumb] = useState<ThumbMetrics>({ height: 0, offset: 0 });
  const [scrollable, setScrollable] = useState(false);
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const { clientHeight, scrollHeight, scrollTop } = viewport;
    const trackHeight = track.clientHeight;
    const range = scrollHeight - clientHeight;
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
  }, []);

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
    if (!viewport) return;
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
      hidden={hidden}
    >
      <div
        ref={viewportRef}
        className={joinClassNames(styles.viewport, viewportClassName)}
        onScroll={(event) => {
          measure();
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
        />
      </div>
    </div>
  );
}
