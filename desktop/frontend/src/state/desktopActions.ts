import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import {
  OpenDataDirectory,
  OpenExternalURL,
  PickDataDirectory,
  PickLocalFiles,
  RestartApplication,
  UpdateDesktopPreferences,
} from "../../bindings/omnimail/desktopservice";
import type { PickedFileInfo } from "../../bindings/omnimail/models";
import type { AppSettings } from "../types/settings";
import { isWailsDesktop, parseMailtoUrl } from "./storageHelpers";

export async function syncDesktopPreferences(next: AppSettings): Promise<void> {
  if (!isWailsDesktop()) return;
  await UpdateDesktopPreferences({
    themePreference: next.themePreference,
    resolvedTheme: next.theme,
    language: next.language,
    closeToTray: next.closeToTray,
    launchAtStartup: next.launchAtStartup,
    silentStartToTray: Boolean(next.silentStartToTray),
  }).catch(() => undefined);
}

export async function pickDesktopDataDir(): Promise<string> {
  if (!isWailsDesktop()) return "";
  return PickDataDirectory().catch(() => "");
}

export async function openDesktopDataDir(): Promise<boolean> {
  if (!isWailsDesktop()) return false;
  await OpenDataDirectory();
  return true;
}

export async function openSafeExternalUrl(url: string): Promise<void> {
  if (!isWailsDesktop()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await OpenExternalURL(url);
}

export async function pickAttachmentFiles(
  title = "选择邮件附件",
): Promise<PickedFileInfo[]> {
  if (!isWailsDesktop()) return [];
  const picked = await PickLocalFiles(title, true).catch(() => []);
  return picked ?? [];
}

export async function restartDesktopApp(): Promise<void> {
  if (!isWailsDesktop()) {
    window.location.reload();
    return;
  }
  await RestartApplication();
}

export interface RuntimeEventHandlers {
  onTrayCompose: (to?: string[], subject?: string, body?: string) => void;
  onTraySyncAll: () => void;
  onOpenExternalFile: (fileName: string) => void;
  onProfileSwitched: () => void;
  onAccountStatus: (p: {
    accountId: string;
    status: string;
    lastError?: string;
  }) => void;
  onSyncProgress: (p: {
    accountId: string;
    stage: string;
    current: number;
    total: number;
    percent: number;
  }) => void;
  onMailDelta?: (p: { folderCounts?: Record<string, number> }) => void;
  onAttachmentProgress?: (p: {
    attachmentId: string;
    status: string;
    progress: number;
  }) => void;
  onOutboxUpdated?: (p: {
    jobId: string;
    state: string;
    notBeforeAt: number;
    lastError?: string;
  }) => void;
  onTrayUnlockProfile?: (profileId: string) => void;
}

export function useDesktopRuntimeEvents(h: RuntimeEventHandlers) {
  useEffect(() => {
    if (!isWailsDesktop()) return;
    const offs = [
      Events.On("tray:new-compose", () => h.onTrayCompose()),
      Events.On("tray:sync-all", () => h.onTraySyncAll()),
      Events.On("app:open-mailto", (ev) => {
        if (typeof ev.data !== "string" || !ev.data) return;
        const p = parseMailtoUrl(ev.data);
        h.onTrayCompose(p.to, p.subject, p.body);
      }),
      Events.On("app:open-file", (ev) => {
        h.onOpenExternalFile(
          typeof ev.data === "string" ? ev.data : "外部邮件归档",
        );
      }),
      Events.On("omnimail:profile:switched", () => h.onProfileSwitched()),
      Events.On("omnimail:account:status", (ev) => {
        if (ev.data && typeof ev.data === "object") {
          h.onAccountStatus(
            ev.data as {
              accountId: string;
              status: string;
              lastError?: string;
            },
          );
        }
      }),
      Events.On("omnimail:sync:progress", (ev) => {
        if (ev.data && typeof ev.data === "object") {
          h.onSyncProgress(
            ev.data as {
              accountId: string;
              stage: string;
              current: number;
              total: number;
              percent: number;
            },
          );
        }
      }),
      Events.On("omnimail:mail:delta", (ev) => {
        h.onMailDelta?.(
          (ev.data as { folderCounts?: Record<string, number> }) ?? {},
        );
      }),
      Events.On("omnimail:attachment:progress", (ev) => {
        if (ev.data && typeof ev.data === "object") {
          h.onAttachmentProgress?.(
            ev.data as {
              attachmentId: string;
              status: string;
              progress: number;
            },
          );
        }
      }),
      Events.On("omnimail:outbox:updated", (ev) => {
        if (ev.data && typeof ev.data === "object") {
          h.onOutboxUpdated?.(
            ev.data as {
              jobId: string;
              state: string;
              notBeforeAt: number;
              lastError?: string;
            },
          );
        }
      }),
      Events.On("omnimail:desktop:intent", (ev) => {
        const d = ev.data as { type?: string; payload?: string } | undefined;
        if (!d?.type) return;
        if (d.type === "compose-mailto" && d.payload) {
          const p = parseMailtoUrl(d.payload);
          h.onTrayCompose(p.to, p.subject, p.body);
        } else if (d.type === "open-eml" && d.payload) {
          h.onOpenExternalFile(d.payload);
        } else if (d.type === "sync-all") {
          h.onTraySyncAll();
        } else if (d.type === "switch-profile" && d.payload) {
          h.onTrayUnlockProfile?.(d.payload);
        }
      }),
    ];
    return () => {
      offs.forEach((off) => off());
    };
  }, [h]);
}
