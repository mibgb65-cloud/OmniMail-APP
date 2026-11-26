import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import {
  updaterApi,
  type UpdaterProgressEvent,
} from "../services/backendClient";
import { isWailsDesktop } from "./storageHelpers";

const INITIAL_AUTO_CHECK_DELAY_MS = 10_000;
const AUTO_RECHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

export function useUpdateBootstrapAndEvents({
  autoCheckEnabled,
  updateChannel,
  onHydrated,
  onScheduledCheck,
  onProgressEvent,
  onUnmount,
}: {
  autoCheckEnabled: boolean;
  updateChannel: string;
  onHydrated: (
    info: Awaited<ReturnType<typeof updaterApi.getBuildInfo>>,
    prefs: Awaited<ReturnType<typeof updaterApi.getPreferences>>,
  ) => void;
  onScheduledCheck: (channel: string) => void;
  onProgressEvent: (ev: UpdaterProgressEvent) => void;
  onUnmount: () => void;
}) {
  useEffect(() => {
    let active = true;
    void Promise.all([
      updaterApi.getBuildInfo().catch(() => updaterApi.defaultBuildInfo),
      updaterApi.getPreferences().catch(() => updaterApi.defaultPrefs),
    ]).then(([info, prefs]) => {
      if (active) onHydrated(info, prefs);
    });
    return () => {
      active = false;
      onUnmount();
    };
  }, [onHydrated, onUnmount]);

  useEffect(() => {
    if (!isWailsDesktop() || !autoCheckEnabled) return;
    const initTimer = window.setTimeout(() => {
      onScheduledCheck(updateChannel);
    }, INITIAL_AUTO_CHECK_DELAY_MS);
    const intervalTimer = window.setInterval(() => {
      onScheduledCheck(updateChannel);
    }, AUTO_RECHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(intervalTimer);
    };
  }, [autoCheckEnabled, updateChannel, onScheduledCheck]);

  useEffect(() => {
    if (!isWailsDesktop()) return;
    const off = Events.On("updater:progress", (ev) => {
      if (ev.data && typeof ev.data === "object") {
        onProgressEvent(ev.data as UpdaterProgressEvent);
      }
    });
    return () => {
      off();
    };
  }, [onProgressEvent]);
}
