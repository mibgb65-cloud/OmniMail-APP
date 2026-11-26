import {
  CancelUpdateDownload,
  CheckForUpdates,
  DownloadUpdate,
  GetAppBuildInfo,
  GetUpdatePreferences,
  InstallDownloadedUpdate,
  OpenUpdateDownloadDir,
  SkipUpdateVersion,
  UpdateUpdatePreferences,
} from "../../bindings/omnimail/desktopservice";
import type {
  AppBuildInfo,
  UpdateCheckResult,
  UpdateDownloadRequest,
  UpdatePreferencesDTO,
} from "../../bindings/omnimail/models";
import { isWailsDesktop } from "../state/storageHelpers";

export interface UpdaterProgressEvent {
  stage:
    | "downloading"
    | "verifying"
    | "ready"
    | "installing"
    | "error"
    | "cancelled";
  version?: string;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  percent: number;
  sha256?: string;
  filePath?: string;
  autoInstall?: boolean;
  error?: string;
}

const DEFAULT_BUILD_INFO: AppBuildInfo = {
  version: "v0.0.1",
  channel: "stable",
  buildTime: "dev",
  isBeta: false,
};

const DEFAULT_PREFS: UpdatePreferencesDTO = {
  autoCheckUpdates: true,
  updateChannel: "stable",
  skippedVersion: "",
  lastUpdateCheckAt: 0,
};

export const updaterApi = {
  defaultBuildInfo: DEFAULT_BUILD_INFO,
  defaultPrefs: DEFAULT_PREFS,

  async getBuildInfo(): Promise<AppBuildInfo> {
    if (!isWailsDesktop()) return DEFAULT_BUILD_INFO;
    const info = await GetAppBuildInfo();
    return info?.version ? info : DEFAULT_BUILD_INFO;
  },

  async getPreferences(): Promise<UpdatePreferencesDTO> {
    if (!isWailsDesktop()) return DEFAULT_PREFS;
    return GetUpdatePreferences();
  },

  async updatePreferences(
    patch: UpdatePreferencesDTO,
  ): Promise<UpdatePreferencesDTO> {
    if (!isWailsDesktop()) return patch;
    return UpdateUpdatePreferences(patch);
  },

  async skipVersion(version: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await SkipUpdateVersion(version);
  },

  async checkForUpdates(
    channel = "",
    manual = false,
  ): Promise<UpdateCheckResult> {
    if (!isWailsDesktop()) {
      return {
        currentVersion: DEFAULT_BUILD_INFO.version,
        latestVersion: DEFAULT_BUILD_INFO.version,
        channel: channel || "stable",
        hasUpdate: false,
        skipped: false,
        releaseUrl: "https://github.com/omnimail-org/omnimail/releases",
        releaseNotes: "",
        publishedAt: "",
        checkedAt: new Date().toISOString(),
        checkedAtUnix: Date.now(),
        assetName: "",
        assetUrl: "",
        assetSize: 0,
        sumsUrl: "",
      };
    }
    return CheckForUpdates(channel, manual);
  },

  async downloadUpdate(req: UpdateDownloadRequest): Promise<void> {
    if (!isWailsDesktop()) return;
    await DownloadUpdate(req);
  },

  async cancelDownload(): Promise<void> {
    if (!isWailsDesktop()) return;
    await CancelUpdateDownload();
  },

  async installDownloaded(filePath: string, silent = true): Promise<void> {
    if (!isWailsDesktop()) return;
    await InstallDownloadedUpdate(filePath, silent);
  },

  async openDownloadDir(filePath = ""): Promise<void> {
    if (!isWailsDesktop()) return;
    await OpenUpdateDownloadDir(filePath);
  },
};
