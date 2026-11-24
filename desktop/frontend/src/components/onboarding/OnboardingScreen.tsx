import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { BrandLogo } from "../common/BrandLogo";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import {
  WindowControls,
  handleDragRegionDoubleClick,
} from "../shell/WindowControls";
import { OnboardingHero } from "./OnboardingHero";
import { OnboardingInitCard } from "./OnboardingInitCard";

export function OnboardingScreen() {
  const { workspace, desktopBridge, toastStore } = useApp();
  const { t } = useI18n();
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [customDir, setCustomDir] = useState<string | null>(null);
  const effectiveDataDir = customDir ?? desktopBridge.storage.dataDir;
  const canStart = agreeTerms && agreePrivacy;
  const isLight = workspace.settings.theme === "light";
  const openDoc = (doc: "terms" | "privacy") =>
    workspace.setOverlay({ type: "legal-doc", doc });
  const commitAndRun = async (nextAction: () => void) => {
    try {
      await desktopBridge.completeInitialSetup(effectiveDataDir);
      nextAction();
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: t("onboarding.saveDataDirFailed"),
        detail:
          err instanceof Error
            ? err.message
            : t("onboarding.checkDirPermFallback"),
      });
    }
  };
  return (
    <FadeScroll
      className="onboarding-page"
      surface="--bg-canvas"
      label={t("onboarding.pageScrollLabel")}
    >
      <div
        className="row-between window-drag-region"
        onDoubleClick={handleDragRegionDoubleClick}
      >
        <div className="row" style={{ gap: 10 }}>
          <BrandLogo size={32} showWordmark={false} />
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "var(--text-ink)",
              }}
            >
              OmniMail
            </div>
            <div className="text-xs text-muted">
              {t("onboarding.brandTagline")}
            </div>
          </div>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={workspace.toggleTheme}
          >
            <Icon name={isLight ? "moon" : "sun"} size={14} />
            {isLight
              ? t("onboarding.switchToDark")
              : t("onboarding.switchToLight")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void commitAndRun(() => workspace.setScreen("mail"))}
          >
            {t("onboarding.saveAndEnter")}
          </button>
          <WindowControls />
        </div>
      </div>

      <div className="onboarding-grid">
        <OnboardingHero />

        <div className="onboarding-card">
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 21,
                fontWeight: 800,
                color: "var(--text-ink)",
              }}
            >
              {t("onboarding.setupHeading")}
            </h2>
            <p
              className="text-muted"
              style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.55 }}
            >
              {t("onboarding.setupDesc")}
            </p>
          </div>

          <OnboardingInitCard
            dataDir={effectiveDataDir}
            onChangeDataDir={setCustomDir}
          />

          <div
            className="settings-card"
            style={{ gap: 8, padding: "10px 14px" }}
          >
            <Checkbox
              checked={agreeTerms}
              onChange={setAgreeTerms}
              ariaLabel={t("onboarding.agreeTermsAria")}
            >
              {t("onboarding.readAndAgreePrefix")}
              <button
                type="button"
                style={{ color: "var(--brand-accent)", fontWeight: 600 }}
                onClick={() => openDoc("terms")}
              >
                {t("onboarding.termsLink")}
              </button>
            </Checkbox>
            <Checkbox
              checked={agreePrivacy}
              onChange={setAgreePrivacy}
              ariaLabel={t("onboarding.agreePrivacyAria")}
            >
              {t("onboarding.readAndAgreePrefix")}
              <button
                type="button"
                style={{ color: "var(--brand-accent)", fontWeight: 600 }}
                onClick={() => openDoc("privacy")}
              >
                {t("onboarding.privacyLink")}
              </button>
            </Checkbox>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 40, fontSize: 14 }}
            disabled={!canStart}
            onClick={() =>
              void commitAndRun(() =>
                workspace.setOverlay({ type: "add-account" }),
              )
            }
          >
            <Icon name="plus" size={16} />
            {t("onboarding.addFirstMailboxBtn")}
          </button>

          <div
            className="row-between"
            style={{
              paddingTop: 6,
              borderTop: "1px solid var(--border-default)",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                void commitAndRun(() =>
                  workspace.setOverlay({ type: "manual-imap" }),
                )
              }
              disabled={!canStart}
            >
              {t("onboarding.manualImapDirectBtn")}
            </button>
            <span className="text-xs text-muted">
              {t("onboarding.versionEncryptedBadge")}
            </span>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted" style={{ textAlign: "center" }}>
        {t("onboarding.bottomFootnote")}
      </div>
    </FadeScroll>
  );
}
