import type {
  MigrationResult,
  StorageInfo,
  TargetDirCheck,
} from "../../bindings/omnimail/models";
import { t } from "../i18n";
import type { ThemeMode, ThemePreference } from "../types/settings";

export const THEME_STORAGE_KEY = "omnimail:theme";
export const THEME_PREF_STORAGE_KEY = "omnimail:theme-pref";
export const BROWSER_DATADIR_KEY = "omnimail:data-dir";
export const BROWSER_INIT_KEY = "omnimail:initialized";

let bridgeReady = false;

export function setDesktopBridgeReady(ready: boolean) {
  bridgeReady = ready;
}

export function isWailsDesktop(): boolean {
  if (bridgeReady) return true;
  if (typeof window === "undefined") return false;
  const win = window as {
    chrome?: { webview?: unknown };
    webkit?: { messageHandlers?: unknown };
  };
  return Boolean(
    win.chrome?.webview ||
    win.webkit?.messageHandlers ||
    window.location.hostname.endsWith("wails.localhost"),
  );
}

export function resolveSystemTheme(): ThemeMode {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function resolveThemeFromPref(pref: ThemePreference): ThemeMode {
  if (pref === "dark" || pref === "light") return pref;
  return resolveSystemTheme();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const gib = 1024 * 1024 * 1024;
  const mib = 1024 * 1024;
  if (bytes >= gib) return `${(bytes / gib).toFixed(2)} GB`;
  if (bytes >= mib) return `${(bytes / mib).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function buildFallbackStorageInfo(): StorageInfo {
  let savedDir = "%LOCALAPPDATA%\\OmniMail\\Data";
  let initialized = true;
  if (typeof window !== "undefined") {
    try {
      savedDir = window.localStorage.getItem(BROWSER_DATADIR_KEY) || savedDir;
      const rawInit = window.localStorage.getItem(BROWSER_INIT_KEY);
      if (rawInit === "0") initialized = false;
    } catch {
      // 忽略受限存储环境
    }
  }
  return {
    bootstrapPath: "%APPDATA%\\OmniMail\\bootstrap.json",
    dataDir: savedDir,
    initialized,
    usedBytes: 862 * 1024 * 1024,
    freeBytes: 128 * 1024 * 1024 * 1024,
    totalBytes: 512 * 1024 * 1024 * 1024,
  };
}

export function inspectDirectoryInBrowser(
  rawPath: string,
  currentDir: string,
): TargetDirCheck {
  const trimmed = rawPath.trim();
  const isWinAbs = /^[a-zA-Z]:\\.+/.test(trimmed);
  if (!trimmed || !isWinAbs) {
    return {
      valid: false,
      normalizedPath: trimmed,
      writable: false,
      freeBytes: 0,
      requiredBytes: 0,
      sufficientSpace: false,
      sameAsCurrent: false,
      message: t("overlays.migrateInvalidAbsPath"),
    };
  }
  if (/^[a-zA-Z]:\\?$/.test(trimmed)) {
    return {
      valid: false,
      normalizedPath: trimmed,
      writable: false,
      freeBytes: 0,
      requiredBytes: 0,
      sufficientSpace: false,
      sameAsCurrent: false,
      message: t("overlays.migrateRootDirForbidden"),
    };
  }
  const same = trimmed.toLowerCase() === currentDir.toLowerCase();
  return {
    valid: true,
    normalizedPath: trimmed.replace(/\\+$/, ""),
    writable: true,
    freeBytes: 164 * 1024 * 1024 * 1024,
    requiredBytes: 894 * 1024 * 1024,
    sufficientSpace: true,
    sameAsCurrent: same,
    message: same
      ? t("overlays.migrateSameAsCurrentMsg")
      : t("overlays.migrateCheckPassedPreview"),
  };
}

export function parseMailtoUrl(url: string): {
  to: string[];
  subject?: string;
  body?: string;
} {
  const withoutScheme = url.replace(/^mailto:/i, "");
  const [addrPart, queryPart] = withoutScheme.split("?");
  const to = addrPart
    ? decodeURIComponent(addrPart)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const params = new URLSearchParams(queryPart ?? "");
  return {
    to,
    subject: params.get("subject") ?? undefined,
    body: params.get("body") ?? undefined,
  };
}

export type { MigrationResult, StorageInfo, TargetDirCheck };
