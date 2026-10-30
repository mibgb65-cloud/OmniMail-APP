import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const MAX_EXIT_WAIT_MS = 1000;
const EXIT_FINISH_GRACE_MS = 50;

/** 仅延迟视觉关闭；业务请求必须在调用 close 时中止，不能等到退出后卸载。 */
export function useDialogExit(dialogRef: RefObject<HTMLDialogElement>, onClosed: () => void) {
  const [closing, setClosing] = useState(false);
  const requestedRef = useRef(false);
  const onClosedRef = useRef(onClosed);
  useLayoutEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  const close = useCallback(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    const dialog = dialogRef.current;
    if (dialog) {
      // 入场未结束就关闭时，从当前视觉位置接续，不能突然跳回完全不透明再退出。
      const current = getComputedStyle(dialog);
      dialog.style.setProperty('--dialog-exit-opacity', current.opacity || '1');
      dialog.style.setProperty('--dialog-exit-transform', current.transform || 'none');
      if (typeof CSS !== 'undefined' && CSS.supports?.('selector(dialog::backdrop)')) {
        dialog.style.setProperty(
          '--dialog-exit-backdrop-opacity',
          getComputedStyle(dialog, '::backdrop').opacity,
        );
      }
    }
    setClosing(true);
  }, [dialogRef]);

  useLayoutEffect(() => {
    if (!closing) return;
    const dialog = dialogRef.current;
    let finished = false;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    // 收集伪元素时需要 subtree；只等 target 为外框本身的动画，排除业务内容循环动画。
    const animations = reduceMotion
      ? []
      : (dialog?.getAnimations?.({ subtree: true }) ?? []).filter((animation) => {
          const effect = animation.effect;
          return effect && 'target' in effect && effect.target === dialog;
        });
    const endTimes = animations.map((animation) => {
      const end = animation.effect?.getComputedTiming().endTime;
      return typeof end === 'number' && Number.isFinite(end) ? Math.max(0, end) : MAX_EXIT_WAIT_MS;
    });
    // 时长来自真实外框/伪元素动画；仅对丢失的完成信号设有界兜底，不复制 CSS 时长。
    const timer = animations.length
      ? setTimeout(finish, Math.min(MAX_EXIT_WAIT_MS, Math.max(...endTimes) + EXIT_FINISH_GRACE_MS))
      : undefined;
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (dialog?.open) dialog.close();
      onClosedRef.current();
    }
    if (!animations.length) {
      finish();
      return;
    }
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
    return () => {
      // 强制卸载或 StrictMode 清理后，旧动画不能回调父组件或影响下一次打开。
      finished = true;
      clearTimeout(timer);
    };
  }, [closing, dialogRef]);

  return { closing, close };
}
