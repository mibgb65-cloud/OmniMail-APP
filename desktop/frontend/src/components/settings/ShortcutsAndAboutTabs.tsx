import { useEffect, useState } from "react";
import { GetAppBuildInfo } from "../../../bindings/omnimail/desktopservice";
import type { AppBuildInfo } from "../../../bindings/omnimail/models";
import { getShortcutGroups, useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { RuntimeBannerMode } from "../../types/ui";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";

export function ShortcutsTab() {
  const { lang } = useI18n();
  const groups = getShortcutGroups(lang);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((group) => (
        <div key={group.group} className="settings-card">
          <strong style={{ fontSize: 14 }}>{group.group}</strong>
          {group.items.map((item) => (
            <div key={item.desc} className="settings-row">
              <span style={{ fontSize: 13 }}>{item.desc}</span>
              <span className="row" style={{ gap: 4 }}>
                {item.keys.map((k) => (
                  <kbd key={k} className="kbd">
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function AboutTab() {
  const { workspace, toastStore } = useApp();
  const { t, formatTime } = useI18n();
  const [buildInfo, setBuildInfo] = useState<AppBuildInfo>({
    version: "v0.0.1",
    channel: "stable",
    buildTime: "dev",
    isBeta: false,
  });

  useEffect(() => {
    if (!isWailsDesktop()) return;
    let active = true;
    void GetAppBuildInfo()
      .then((info) => {
        if (active && info?.version) setBuildInfo(info);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const bannerOptions: Array<{ id: RuntimeBannerMode; label: string }> = [
    { id: "none", label: t("settings.bannerNone") },
    { id: "offline", label: t("settings.bannerOffline") },
    { id: "auth-expired", label: t("settings.bannerAuthExpired") },
    { id: "auto-reply", label: t("settings.bannerAutoReply") },
    { id: "partial-sync", label: t("settings.bannerPartialSync") },
  ];

  const builtAt =
    buildInfo.buildTime && buildInfo.buildTime !== "dev"
      ? t("settings.aboutBuiltAtPart", {
          time: formatTime(buildInfo.buildTime),
        })
      : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <div className="row-between">
          <div className="row" style={{ gap: 12 }}>
            <BrandLogo size={40} />
            <div>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>
                  OmniMail Desktop
                </span>
                <span
                  className={`pill ${buildInfo.isBeta ? "pill-warning" : "pill-accent"}`}
                >
                  {buildInfo.isBeta
                    ? t("settings.aboutBetaBadge")
                    : t("settings.aboutStableBadge")}
                </span>
              </div>
              <div className="text-xs text-muted">
                {t("settings.aboutVersionRow", {
                  version: buildInfo.version,
                  builtAt,
                })}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              workspace.setOverlay({ type: "update-flow", stage: "checking" })
            }
          >
            <Icon name="refresh" size={14} />{" "}
            {t("settings.aboutCheckUpdatesBtn")}
          </button>
        </div>

        <div className="settings-row">
          <span className="text-xs text-muted">
            {t("settings.aboutSummary")}
          </span>
        </div>

        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({ type: "legal-doc", doc: "terms" })
            }
          >
            {t("settings.aboutViewTermsBtn")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({ type: "legal-doc", doc: "privacy" })
            }
          >
            {t("settings.aboutViewPrivacyBtn")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({
                type: "diagnostics",
                accountId: workspace.accounts[0]?.id ?? "acc-gmail",
              })
            }
          >
            {t("settings.aboutExportDiagBtn")}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          {t("settings.aboutBannerPreviewTitle")}
        </strong>
        <div className="text-xs text-muted">
          {t("settings.aboutBannerPreviewDesc")}
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {bannerOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn btn-sm ${
                workspace.bannerMode === opt.id
                  ? "btn-primary"
                  : "btn-secondary"
              }`}
              onClick={() => {
                workspace.setBannerMode(opt.id);
                toastStore.pushToast({
                  tone: "info",
                  title: t("toasts.switchedBannerMode", { label: opt.label }),
                });
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
