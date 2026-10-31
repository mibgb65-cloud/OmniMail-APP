import { useEffect, useRef } from 'react';

export function useStepIndicator(step: number, locale: string) {
  const trackRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const indicator = indicatorRef.current;
    if (!track || !indicator) return;
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const current = track.querySelector<HTMLElement>('[aria-current="step"]');
      if (!current) return;
      const bounds = current.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const container = track.getBoundingClientRect();
      indicator.style.transform = `translateY(${bounds.top - container.top}px)`;
      indicator.style.height = `${bounds.height}px`;
      indicator.dataset.positioned = 'true';
    };
    // useMailDialog 的 effect 已打开原生模态层，此时测量才不是关闭态的零尺寸。
    update();
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      update();
      secondFrame = requestAnimationFrame(() => {
        if (indicator.dataset.positioned === 'true') indicator.dataset.animate = 'true';
      });
    });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : undefined;
    observer?.observe(track);
    track.querySelectorAll('li').forEach((item) => observer?.observe(item));
    window.addEventListener('resize', update);
    return () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.removeEventListener('resize', update);
    };
    // 不重建背景或重置 animate 标记，反向/连续操作由 CSS 从当前插值位置自然接续。
  }, [step, locale]);

  return { trackRef, indicatorRef };
}
