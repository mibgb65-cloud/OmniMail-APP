declare global {
  interface Window {
    __OMNIMAIL_SPLASH_STATE__?: "done";
    _wails?: unknown;
  }
}

export function resolveLaunchSplashOptions(isHmrReload: boolean) {
  const skip = { skip: true, extraHoldMs: 0 };
  if (
    typeof window === "undefined" ||
    isHmrReload ||
    window.__OMNIMAIL_SPLASH_STATE__ === "done"
  ) {
    return skip;
  }

  const params = new URLSearchParams(window.location.search);
  const skipParams = ["autostart", "silent", "minimized", "tray", "wake"];
  if (
    skipParams.some((param) => params.get(param) === "1") ||
    params.get("from") === "tray"
  ) {
    return skip;
  }

  const rawHold = params.get("bootHoldMs") ?? "";
  const extraHoldMs = /^\d{1,4}$/.test(rawHold)
    ? Math.min(5000, Number(rawHold))
    : 0;
  return { skip: false, extraHoldMs };
}
