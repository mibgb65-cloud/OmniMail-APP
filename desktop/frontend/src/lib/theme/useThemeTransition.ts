import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';

interface ThemeTransitionRun {
  updated: boolean;
  cancelled: boolean;
  readySettled: boolean;
  nativeFinished: boolean;
  animationFinished: boolean;
  transition?: ViewTransition;
  animation?: Animation;
}

export function useThemeTransition(onToggleTheme: () => void) {
  const active = useRef<ThemeTransitionRun | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => {
      if (!media?.matches) return;
      active.current?.animation?.cancel();
      active.current?.transition?.skipTransition();
    };
    media?.addEventListener('change', onMotionChange);
    return () => {
      media?.removeEventListener('change', onMotionChange);
      const run = active.current;
      if (!run) return;
      run.cancelled = true;
      run.animation?.cancel();
      run.transition?.skipTransition();
      active.current = null;
      document.documentElement.removeAttribute('data-theme-transition');
    };
  }, []);

  const toggleThemeWithTransition = (event: MouseEvent<HTMLElement>) => {
    // 快照尚未提交时不启动第二次切换，避免连续点击产生旧状态覆盖。
    if (active.current) return;
    const root = document.documentElement;
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (
      prefersReducedMotion ||
      typeof document.startViewTransition !== 'function' ||
      typeof root.animate !== 'function'
    ) {
      onToggleTheme();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.detail === 0 ? bounds.left + bounds.width / 2 : event.clientX;
    const pointerY = event.detail === 0 ? bounds.top + bounds.height / 2 : event.clientY;
    const x = Math.min(window.innerWidth, Math.max(0, Number.isFinite(pointerX) ? pointerX : 0));
    const y = Math.min(window.innerHeight, Math.max(0, Number.isFinite(pointerY) ? pointerY : 0));
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const run: ThemeTransitionRun = {
      updated: false,
      cancelled: false,
      readySettled: false,
      nativeFinished: false,
      animationFinished: false,
    };
    active.current = run;
    setIsTransitioning(true);
    root.dataset.themeTransition = 'circular';

    const commitTheme = () => {
      if (run.cancelled || run.updated) return;
      run.updated = true;
      // useTheme 的 layout effect 必须在新主题快照前完成，保留其偏好存储逻辑。
      flushSync(onToggleTheme);
    };
    const finish = () => {
      if (active.current !== run) return;
      if (!run.readySettled || !run.nativeFinished || (run.animation && !run.animationFinished))
        return;
      // WAAPI 与 View Transition 的结束是两件事，两者完成后才能释放伪元素效果和切换锁。
      run.animation?.cancel();
      active.current = null;
      root.removeAttribute('data-theme-transition');
      setIsTransitioning(false);
    };

    try {
      const transition = document.startViewTransition(commitTheme);
      run.transition = transition;
      void transition.ready.then(
        () => {
          run.readySettled = true;
          if (run.cancelled) return;
          if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            transition.skipTransition();
            finish();
            return;
          }
          try {
            run.animation = root.animate(
              {
                clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
              },
              {
                duration: 700,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                pseudoElement: '::view-transition-new(root)',
                // 起始帧保持零半径，结束后不保留填充，避免污染后续伪元素快照。
                fill: 'backwards',
              },
            );
            void run.animation.finished.then(
              () => {
                run.animationFinished = true;
                finish();
              },
              () => {
                run.animationFinished = true;
                if (!run.cancelled) transition.skipTransition();
                finish();
              },
            );
          } catch {
            // 部分 WebView 支持快照但不支持伪元素动画，保留已提交主题并跳过动效。
            transition.skipTransition();
          }
          finish();
        },
        () => {
          run.readySettled = true;
          // 快照可能因后台窗口或浏览器策略被跳过；主题仍须且只能更新一次。
          commitTheme();
          transition.skipTransition();
          finish();
        },
      );
      void transition.finished.then(
        () => {
          run.nativeFinished = true;
          finish();
        },
        () => {
          run.nativeFinished = true;
          run.animationFinished = true;
          finish();
        },
      );
    } catch {
      commitTheme();
      run.readySettled = true;
      run.nativeFinished = true;
      finish();
    }
  };

  return { toggleThemeWithTransition, isTransitioning };
}
