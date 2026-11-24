import type { AppSettingsPatch } from "../../bindings/omnimail/internal/config/models";
import type {
  CreateProfileRequest,
  ProfileSummary,
  UpdateProfileRequest,
} from "../../bindings/omnimail/internal/profilemgr/models";
import * as ProfileService from "../../bindings/omnimail/services/profileservice";
import { INITIAL_SETTINGS } from "../data/settingsDefaults";
import { readStoredLanguage, t } from "../i18n";
import {
  isWailsDesktop,
  readStoredDarkHtmlMode,
  resolveThemeFromPref,
} from "../state/storageHelpers";
import type { AppSettings, ThemePreference } from "../types/settings";

export type { CreateProfileRequest, ProfileSummary, UpdateProfileRequest };

export interface NormalizedProfileList {
  activeProfileId: string;
  launchBehavior: "last-profile" | "ask-on-launch";
  requiresUnlock: boolean;
  profiles: ProfileSummary[];
}

let browserProfiles: ProfileSummary[] = [
  {
    id: "personal",
    name: "个人工作空间",
    badge: "个",
    color: "#141E2E",
    profileDir: "%LOCALAPPDATA%\\OmniMail\\Data\\profiles\\personal",
    themePreference: "system",
    pinEnabled: false,
    locked: false,
    accountCount: 4,
    createdAt: "2026-11-22T10:00:00Z",
    lastActiveAt: "2026-11-22T21:20:00Z",
  },
];
let browserActiveId = "personal";
let browserSettings: AppSettings = {
  ...INITIAL_SETTINGS,
  language: readStoredLanguage(),
};

export function mapBackendSettings(raw: Partial<AppSettings>): AppSettings {
  const pref = (
    raw.themePreference === "light" ||
    raw.themePreference === "dark" ||
    raw.themePreference === "system"
      ? raw.themePreference
      : "system"
  ) as ThemePreference;
  return {
    ...INITIAL_SETTINGS,
    ...raw,
    themePreference: pref,
    theme: resolveThemeFromPref(pref),
    darkHtmlMode: raw.darkHtmlMode ?? readStoredDarkHtmlMode(),
    offlineRetentionDays:
      raw.offlineRetentionDays === 30 || raw.offlineRetentionDays === 180
        ? raw.offlineRetentionDays
        : 90,
    undoSendSeconds:
      raw.undoSendSeconds === 5 || raw.undoSendSeconds === 20
        ? raw.undoSendSeconds
        : 10,
  };
}

export const profileApi = {
  async listProfiles(): Promise<NormalizedProfileList> {
    if (!isWailsDesktop()) {
      return {
        activeProfileId: browserActiveId,
        launchBehavior: "last-profile",
        requiresUnlock: false,
        profiles: browserProfiles,
      };
    }
    const res = await ProfileService.ListProfiles();
    return {
      activeProfileId: res.activeProfileId || "personal",
      launchBehavior:
        res.launchBehavior === "ask-on-launch"
          ? "ask-on-launch"
          : "last-profile",
      requiresUnlock: Boolean(res.requiresUnlock),
      profiles: res.profiles ?? [],
    };
  },

  async createProfile(req: CreateProfileRequest): Promise<ProfileSummary> {
    if (!isWailsDesktop()) {
      const item: ProfileSummary = {
        id: `prof-${Date.now()}`,
        name: req.name,
        badge: req.badge || req.name.slice(0, 1) || t("common.newBadge"),
        color: req.color || "#2563EB",
        profileDir: `%LOCALAPPDATA%\\OmniMail\\Data\\profiles\\${req.name}`,
        themePreference: req.themePreference || "system",
        pinEnabled: Boolean(req.pin),
        locked: false,
        accountCount: 0,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      browserProfiles = [...browserProfiles, item];
      return item;
    }
    return ProfileService.CreateProfile(req);
  },

  async updateProfile(req: UpdateProfileRequest): Promise<ProfileSummary> {
    if (!isWailsDesktop()) {
      const patch: Partial<ProfileSummary> = {};
      if (req.name) patch.name = req.name;
      if (req.badge) patch.badge = req.badge;
      if (req.color) patch.color = req.color;
      browserProfiles = browserProfiles.map((p) =>
        p.id === req.id ? { ...p, ...patch } : p,
      );
      return browserProfiles.find((p) => p.id === req.id) ?? browserProfiles[0];
    }
    return ProfileService.UpdateProfile(req);
  },

  async switchProfile(
    profileId: string,
    pin = "",
  ): Promise<{ profile: ProfileSummary; settings: AppSettings }> {
    if (!isWailsDesktop()) {
      browserActiveId = profileId;
      const found =
        browserProfiles.find((p) => p.id === profileId) ?? browserProfiles[0];
      return { profile: found, settings: browserSettings };
    }
    const res = await ProfileService.SwitchProfile(profileId, pin);
    return {
      profile: res.profile,
      settings: mapBackendSettings(
        res.settings as unknown as Partial<AppSettings>,
      ),
    };
  },

  async lockProfile(profileId: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await ProfileService.LockProfile(profileId);
  },

  async deleteProfile(
    profileId: string,
    deleteLocalFiles: boolean,
    pin = "",
  ): Promise<void> {
    if (!isWailsDesktop()) {
      browserProfiles = browserProfiles.filter((p) => p.id !== profileId);
      return;
    }
    await ProfileService.DeleteProfile(profileId, deleteLocalFiles, pin);
  },

  async exportBackup(
    profileId: string,
    includeAttachments: boolean,
    includeSecrets = false,
    exportPassword = "",
  ): Promise<string> {
    if (!isWailsDesktop())
      return "D:\\OmniMailData\\exports\\backup-preview.zip";
    return ProfileService.ExportProfileBackup(profileId, {
      useSaveDialog: true,
      includeAttachments,
      includeSecrets,
      exportPassword,
    });
  },

  async getAppSettings(): Promise<AppSettings> {
    if (!isWailsDesktop()) return browserSettings;
    const raw = await ProfileService.GetAppSettings();
    return mapBackendSettings(raw as unknown as Partial<AppSettings>);
  },

  async updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    if (!isWailsDesktop()) {
      browserSettings = { ...browserSettings, ...patch };
      return browserSettings;
    }
    const raw = await ProfileService.UpdateAppSettings(
      patch as unknown as AppSettingsPatch,
    );
    return mapBackendSettings(raw as unknown as Partial<AppSettings>);
  },
};
