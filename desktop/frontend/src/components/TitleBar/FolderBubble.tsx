import { useEffect, useRef, useState } from 'react';

import styles from './TitleBar.module.css';

interface FolderBubbleProps {
  title: string;
}

type BubblePhase = 'idle' | 'exit' | 'ellipsis' | 'ellipsis-exit' | 'enter';

export function FolderBubble({ title }: FolderBubbleProps) {
  const [displayedTitle, setDisplayedTitle] = useState(title);
  const [phase, setPhase] = useState<BubblePhase>('idle');
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const previousTitle = useRef(title);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const ellipsisMeasureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media?.matches ?? false);
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const changed = previousTitle.current !== title;
    previousTitle.current = title;
    const resize = (measure: HTMLSpanElement | null) => {
      const bubble = bubbleRef.current;
      if (!bubble || !measure) return;
      const style = window.getComputedStyle(bubble);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      bubble.style.width = `${Math.ceil(measure.getBoundingClientRect().width + padding + border)}px`;
    };

    if (reducedMotion) {
      resize(titleMeasureRef.current);
      const timer = window.setTimeout(() => {
        setDisplayedTitle(title);
        setPhase('idle');
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (!changed) {
      resize(titleMeasureRef.current);
      return;
    }

    // 先清空旧文字，再收缩至省略号；省略号完整显示约 400ms 后才开始下一段。
    const timers = [
      window.setTimeout(() => setPhase('exit'), 0),
      window.setTimeout(() => {
        setDisplayedTitle('……');
        setPhase('ellipsis');
        resize(ellipsisMeasureRef.current);
      }, 160),
      window.setTimeout(() => setPhase('ellipsis-exit'), 900),
      window.setTimeout(() => {
        setDisplayedTitle(title);
        setPhase('enter');
        resize(titleMeasureRef.current);
      }, 1_060),
      window.setTimeout(() => setPhase('idle'), 1_600),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [title, reducedMotion]);

  return (
    <h1 className={styles['folder-heading']} aria-label={title} aria-live="polite">
      <span
        ref={bubbleRef}
        className={styles['folder-bubble']}
        data-phase={reducedMotion ? 'idle' : phase}
        aria-hidden="true"
      >
        <span className={styles['folder-bubble-text']}>
          {reducedMotion ? title : displayedTitle}
        </span>
      </span>
      <span
        ref={titleMeasureRef}
        className={styles['folder-measure']}
        data-label={title}
        aria-hidden="true"
      />
      <span
        ref={ellipsisMeasureRef}
        className={styles['folder-measure']}
        data-label="……"
        aria-hidden="true"
      />
    </h1>
  );
}
