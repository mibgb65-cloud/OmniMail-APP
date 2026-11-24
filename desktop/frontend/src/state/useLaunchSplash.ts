import { useEffect, useState } from "react";
import { CheckConnection } from "../../bindings/omnimail/desktopservice";
import { useI18n } from "../i18n";
import { profileApi } from "../services/backendClient";
import { resolveLaunchSplashOptions } from "./launchSplashOptions";
import { isWailsDesktop } from "./storageHelpers";

export type SplashPhase = "waiting" | "active" | "exiting" | "done";

const MIN_HOLD_MS = 850;
const SLOW_THRESHOLD_MS = 2000;
const STAGE_THREE_MS = 3200;
const EXIT_MS = 260;
const REDUCED_EXIT_MS = 120;

const isHmrReload = Boolean(import.meta.hot?.data?.hmrReloaded);
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.hmrReloaded = true;
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runParallelBootInit(extraHoldMs: number): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (isWailsDesktop()) {
    tasks.push(
      Promise.race([
        Promise.all([
          CheckConnection().catch(() => ""),
          profileApi.listProfiles().catch(() => null),
        ]),
        waitMs(3500),
      ]),
    );
  }
  if (typeof document !== "undefined" && document.fonts?.ready) {
    tasks.push(
      Promise.race([document.fonts.ready.catch(() => null), waitMs(600)]),
    );
  }
  if (extraHoldMs > 0) tasks.push(waitMs(extraHoldMs));
  await Promise.all(tasks);
}

export function useLaunchSplash(accountCount: number) {
  const { t } = useI18n();
  const [boot] = useState(() => resolveLaunchSplashOptions(isHmrReload));
  const [phase, setPhase] = useState<SplashPhase>(() =>
    boot.skip ? "done" : "waiting",
  );
  const [progress, setProgress] = useState(0.22);
  const [isSlowLoad, setIsSlowLoad] = useState(false);
  const [stageIndex, setStageIndex] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (phase === "done") {
      document.documentElement.removeAttribute("data-splash-active");
      return;
    }
    document.documentElement.setAttribute(
      "data-splash-active",
      phase === "exiting" ? "exiting" : "true",
    );
  }, [phase]);

  const waitingForWindow = phase === "waiting";
  useEffect(() => {
    if (!waitingForWindow) return;
    let frame = 0;
    const startWhenVisible = () => {
      window.cancelAnimationFrame(frame);
      // 普通启动时 WebView2 也可能短暂不可见；等窗口可见才开始播放并计时。
      if (document.visibilityState === "visible") {
        frame = window.requestAnimationFrame(() => {
          if (document.visibilityState === "visible") setPhase("active");
        });
      }
    };
    document.addEventListener("visibilitychange", startWhenVisible);
    startWhenVisible();
    return () => {
      document.removeEventListener("visibilitychange", startWhenVisible);
      window.cancelAnimationFrame(frame);
    };
  }, [waitingForWindow]);

  useEffect(() => {
    if (boot.skip || waitingForWindow) return;
    let cancelled = false;
    const bootTs = performance.now();

    const t1 = window.setTimeout(() => {
      if (!cancelled) setProgress(0.58);
    }, 240);
    const t2 = window.setTimeout(() => {
      if (!cancelled) setProgress(0.84);
    }, 540);
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) {
        setIsSlowLoad(true);
        setStageIndex(1);
      }
    }, SLOW_THRESHOLD_MS);
    const stageThreeTimer = window.setTimeout(() => {
      if (!cancelled) setStageIndex(2);
    }, STAGE_THREE_MS);

    let holdTimer = 0;
    let exitTimer = 0;

    void runParallelBootInit(boot.extraHoldMs).then(() => {
      if (cancelled) return;
      const elapsed = performance.now() - bootTs;
      const remainHold = Math.max(0, MIN_HOLD_MS - elapsed);

      holdTimer = window.setTimeout(() => {
        if (cancelled) return;
        setProgress(1);
        setPhase("exiting");
        const reduced =
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
          false;
        exitTimer = window.setTimeout(
          () => {
            if (cancelled) return;
            window.__OMNIMAIL_SPLASH_STATE__ = "done";
            setPhase("done");
          },
          reduced ? REDUCED_EXIT_MS : EXIT_MS,
        );
      }, remainHold);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(slowTimer);
      window.clearTimeout(stageThreeTimer);
      window.clearTimeout(holdTimer);
      window.clearTimeout(exitTimer);
    };
  }, [boot.extraHoldMs, boot.skip, waitingForWindow]);

  const statusMessages: [string, string, string] = [
    t("topbar.splashLoadingAccounts", { count: accountCount }),
    t("topbar.splashRestoringCache"),
    t("topbar.splashCheckingKeyring"),
  ];

  const workspaceSplashState: "holding" | "revealing" | undefined =
    phase === "waiting" || phase === "active"
      ? "holding"
      : phase === "exiting"
        ? "revealing"
        : undefined;

  return {
    phase,
    progress,
    isSlowLoad,
    statusText: statusMessages[stageIndex],
    workspaceSplashState,
  };
}
