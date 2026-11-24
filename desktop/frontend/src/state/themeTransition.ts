import type { ThemeMode } from "../types/settings";
import { resolveThemeOrigin } from "./themeStorage";

export { persistLocalTheme, readInitialThemeState } from "./themeStorage";

interface ViewTransitionHandle {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition?: () => void;
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => ViewTransitionHandle;
};

interface ActiveVtSession {
  vt: ViewTransitionHandle | null;
  fromTheme: ThemeMode;
  toTheme: ThemeMode;
  desiredTheme: ThemeMode;
  anim: Animation | null;
  keepAlive: Animation | null;
  guardTimer: number;
  finishGen: number;
  settled: boolean;
  onSettled: (finalTheme: ThemeMode) => void;
}

const THEME_EASE = "cubic-bezier(0.36, 0, 0.2, 1)";
const REDUCED_FADE_MS = 280;
const SYNC_FALLBACK_MS = 320;

let activeSession: ActiveVtSession | null = null;
let syncCleanupTimer = 0;

export function getEffectiveTheme(): ThemeMode {
  if (activeSession && !activeSession.settled)
    return activeSession.desiredTheme;
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function cleanupSession(session: ActiveVtSession, finalTheme: ThemeMode) {
  if (session.settled) return;
  session.settled = true;
  if (activeSession === session) activeSession = null;
  window.clearTimeout(session.guardTimer);
  try {
    session.anim?.cancel();
    session.keepAlive?.cancel();
  } catch {
    // 忽略伪元素销毁竞态
  }
  const root = document.documentElement;
  root.removeAttribute("data-vt-switching");
  root.setAttribute("data-theme", finalTheme);
  root.style.colorScheme = finalTheme;
  session.onSettled(finalTheme);
}

function settleFromAnimFinish(session: ActiveVtSession) {
  if (session.settled) return;
  const gen = ++session.finishGen;
  const finalTheme = session.desiredTheme;
  if (finalTheme === session.toTheme) {
    cleanupSession(session, finalTheme);
    return;
  }
  const root = document.documentElement;
  root.setAttribute("data-theme", finalTheme);
  root.style.colorScheme = finalTheme;
  window.requestAnimationFrame(() => {
    if (session.settled || session.finishGen !== gen) return;
    cleanupSession(session, finalTheme);
  });
}

export function runThemeTransition(
  nextTheme: ThemeMode,
  onSettled: (finalTheme: ThemeMode) => void,
) {
  const root = document.documentElement;

  // 连续切换：直接原地反向正在运行的 GPU 动画，零重截屏、零丢帧
  if (activeSession && !activeSession.settled) {
    activeSession.onSettled = onSettled;
    if (activeSession.desiredTheme === nextTheme) return;
    activeSession.desiredTheme = nextTheme;
    activeSession.finishGen += 1;
    if (activeSession.anim) {
      const wantForward = nextTheme === activeSession.toTheme;
      const goingForward = activeSession.anim.playbackRate >= 0;
      if (wantForward !== goingForward) {
        activeSession.anim.reverse();
      } else if (activeSession.anim.playState === "finished") {
        activeSession.anim.play();
      }
    }
    return;
  }

  const domTheme: ThemeMode =
    root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  if (domTheme === nextTheme) {
    onSettled(nextTheme);
    return;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as ViewTransitionDoc;

  if (
    typeof doc.startViewTransition === "function" &&
    document.visibilityState === "visible"
  ) {
    const { x, y } = resolveThemeOrigin();
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const duration = Math.min(460, Math.max(380, Math.round(endRadius * 0.25)));
    const session: ActiveVtSession = {
      vt: null,
      fromTheme: domTheme,
      toTheme: nextTheme,
      desiredTheme: nextTheme,
      anim: null,
      keepAlive: null,
      guardTimer: 0,
      finishGen: 0,
      settled: false,
      onSettled,
    };
    activeSession = session;

    try {
      const vt = doc.startViewTransition(() => {
        root.setAttribute("data-vt-switching", "true");
        root.setAttribute("data-theme", session.toTheme);
        root.style.colorScheme = session.toTheme;
      });
      session.vt = vt;
      session.guardTimer = window.setTimeout(() => {
        if (!session.settled && !session.anim) {
          vt.skipTransition?.();
          cleanupSession(session, session.desiredTheme);
        }
      }, 450);

      void vt.ready
        .then(() => {
          window.clearTimeout(session.guardTimer);
          if (session.settled) return;
          session.keepAlive = root.animate(
            { opacity: [1, 1] },
            { duration: 30000, pseudoElement: "::view-transition-old(root)" },
          );
          const keyframes = reduced
            ? { opacity: [0, 1] }
            : {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
              };
          const anim = root.animate(keyframes, {
            duration: reduced ? REDUCED_FADE_MS : duration,
            easing: THEME_EASE,
            fill: "both",
            pseudoElement: "::view-transition-new(root)",
          });
          session.anim = anim;
          if (session.desiredTheme !== session.toTheme) {
            anim.currentTime = 48;
            anim.reverse();
          }
          anim.onfinish = () => settleFromAnimFinish(session);
        })
        .catch(() => cleanupSession(session, session.desiredTheme));

      void vt.finished.finally(() => {
        if (!session.settled) cleanupSession(session, session.desiredTheme);
      });
      return;
    } catch {
      cleanupSession(session, session.desiredTheme);
      return;
    }
  }

  window.clearTimeout(syncCleanupTimer);
  root.setAttribute("data-theme-sync", "true");
  root.setAttribute("data-theme", nextTheme);
  root.style.colorScheme = nextTheme;
  onSettled(nextTheme);
  syncCleanupTimer = window.setTimeout(() => {
    root.removeAttribute("data-theme-sync");
  }, SYNC_FALLBACK_MS + 40);
}
