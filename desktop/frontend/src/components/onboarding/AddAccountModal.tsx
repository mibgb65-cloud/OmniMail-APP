import { useEffect, useState } from "react";
import { PROVIDER_CATALOG } from "../../data/providers";
import { localizeProviderPreset, useI18n } from "../../i18n";
import { accountApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { ProviderCatalogItem } from "../../types/account";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";

export function AddAccountModal() {
  const { workspace } = useApp();
  const { lang, t } = useI18n();
  const [presets, setPresets] =
    useState<ProviderCatalogItem[]>(PROVIDER_CATALOG);

  useEffect(() => {
    let mounted = true;
    void accountApi
      .listProviderPresets()
      .then((list) => {
        if (mounted && list.length > 0) setPresets(list);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModalShell
      heading={t("onboarding.addAccountHeading")}
      subtitle={t("onboarding.addAccountSubtitle")}
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => workspace.setOverlay({ type: "manual-imap" })}
          >
            <Icon name="server" size={14} />{" "}
            {t("onboarding.otherManualImapBtn")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            {t("common.close")}
          </button>
        </>
      }
    >
      <div className="provider-grid">
        {presets.map((rawItem) => {
          const item = localizeProviderPreset(rawItem, lang);
          return (
            <button
              key={item.id}
              type="button"
              className="provider-card"
              onClick={() => {
                if (item.authMode === "oauth") {
                  workspace.setOverlay({
                    type: "oauth-flow",
                    provider: item.id,
                    stage: "waiting",
                  });
                } else {
                  workspace.setOverlay({
                    type: "provider-guide",
                    provider: item.id,
                  });
                }
              }}
            >
              <div className="row" style={{ gap: 11, minWidth: 0 }}>
                <ProviderIcon provider={item.id} size={32} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--text-ink)",
                    }}
                  >
                    {item.name}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {item.subtitle}
                  </div>
                </div>
              </div>
              <span
                className={`pill ${
                  item.badgeTone === "blue"
                    ? "pill-accent"
                    : item.badgeTone === "violet"
                      ? "pill-ai"
                      : item.badgeTone === "amber"
                        ? "pill-warning"
                        : "pill-neutral"
                }`}
                style={{ flexShrink: 0 }}
              >
                {item.badgeText}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className="provider-card"
          onClick={() => workspace.setOverlay({ type: "muse-connect" })}
        >
          <div className="row" style={{ gap: 11, minWidth: 0 }}>
            <ProviderIcon provider="muse" size={32} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--text-ink)",
                }}
              >
                {t("muse.providerName")}
              </div>
              <div className="text-xs text-muted truncate">
                {t("muse.addModalCardSub")}
              </div>
            </div>
          </div>
          <span className="pill pill-accent" style={{ flexShrink: 0 }}>
            {t("muse.addModalCardBadge")}
          </span>
        </button>
      </div>

      <div className="settings-card">
        <div
          className="row"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--text-ink)" }}
        >
          <Icon name="info" size={15} />
          <span>{t("onboarding.compatInfoTitle")}</span>
        </div>
        <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
          {t("onboarding.compatBullet1Prefix")}
          <strong>Gmail</strong>
          {t("onboarding.compatBullet1Body")}
          <br />
          {t("onboarding.compatBullet1Prefix")}
          <strong>{t("onboarding.compatBullet2Netease")}</strong>
          {t("onboarding.compatBullet2Mid")}
          <strong>Naver Mail</strong>
          {t("onboarding.compatBullet2Suffix")}
          <br />
          {t("onboarding.compatBullet3")}
        </div>
      </div>
    </ModalShell>
  );
}
