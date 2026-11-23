import { useEffect, useState } from "react";
import { CheckConnection } from "../../bindings/omnimail/desktopservice";
import { profileApi } from "../services/backendClient";
import { isWailsDesktop } from "./storageHelpers";

export type SplashPhase = "active" | "exiting" | "done";

declare global {
  interface Window {
    __OMNIMAIL_BOOT_TS__?: number;
    __OMNIMAIL_SPLASH_STATE__?: "running" | "done";
    _wails?: unknown;
  }
}

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

interface BootOptions {
  skip: boolean;
  extraHoldMs: number;
}

function resolveBootOptions(): BootOptions {
  if (typeof window === "undefined") return { skip: true, extraHoldMs: 0 };
  if (isHmrReload || window.__OMNIMAIL_SPLASH_STATE__ === "done") {
    return { skip: true, extraHoldMs: 0 };
  }

  const params = new URLSearchParams(window.location.search);
  const silentBoot =
    params.get("autostart") === "1" ||
    params.get("silent") === "1" ||
    params.get("minimized") === "1";
  const trayWake =
    params.get("tray") === "1" ||
    params.get("wake") === "1" ||
    params.get("from") === "tray";
  let traySession = false;
  try {
    traySession = window.sessionStorage.getItem("omnimail:tray-wake") === "1";
  } catch {
    // 忽略受限存储环境异常
  }

  const rawHold = params.get("bootHoldMs") ?? "";
  const extraHoldMs = /^\d{1,4}$/.test(rawHold)
    ? Math.min(5000, Number(rawHold))
    : 0;

  if (
    silentBoot ||
    trayWake ||
    traySession ||
    document.visibilityState === "hidden"
  ) {
    window.__OMNIMAIL_SPLASH_STATE__ = "done";
    return { skip: true, extraHoldMs: 0 };
  }

  window.__OMNIMAIL_SPLASH_STATE__ = "running";
  return { skip: false, extraHoldMs };
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
  const [boot] = useState<BootOptions>(resolveBootOptions);
  const [phase, setPhase] = useState<SplashPhase>(() =>
    boot.skip ? "done" : "active",
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
      phase === "active" ? "true" : "exiting",
    );
  }, [phase]);

  useEffect(() => {
    if (boot.skip) return;
    let cancelled = false;
    const bootTs = window.__OMNIMAIL_BOOT_TS__ ?? performance.now();

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

    let exitTimer: number | null = null;

    void runParallelBootInit(boot.extraHoldMs).then(() => {
      if (cancelled) return;
      const elapsed = performance.now() - bootTs;
      const remainHold = Math.max(0, MIN_HOLD_MS - elapsed);

      window.setTimeout(() => {
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
      if (exitTimer !== null) window.clearTimeout(exitTimer);
    };
  }, [boot.extraHoldMs, boot.skip]);

  const statusMessages: [string, string, string] = [
    `正在加载本地加密索引与 ${accountCount} 个邮箱账户…`,
    "正在恢复本地邮件缓存…",
    "正在校验本地密钥环与同步状态…",
  ];

  const workspaceSplashState: "holding" | "revealing" | undefined =
    phase === "active"
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
