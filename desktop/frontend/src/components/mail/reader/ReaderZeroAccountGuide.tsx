import { FadeScroll } from "../../common/scroll-fade/FadeScroll";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { ProviderId } from "../../../types/account";
import { ProviderIcon } from "../../common/ProviderIcon";
import { Icon } from "../../common/Icon";

export function ReaderZeroAccountGuide() {
  const { t, localizeText } = useI18n();
  const { workspace } = useApp();
  const profileName = workspace.activeProfile?.name
    ? localizeText(workspace.activeProfile.name)
    : t("common.personalWorkspace");
  const quickProviders: Array<{
    id: ProviderId;
    label: string;
    action: "oauth" | "guide" | "manual";
  }> = [
    { id: "gmail", label: "Gmail", action: "oauth" },
    { id: "qq", label: t("reader.zeroChipQq"), action: "guide" },
    { id: "netease", label: t("reader.zeroChipNetease"), action: "guide" },
    { id: "outlook", label: "Outlook", action: "oauth" },
    { id: "icloud", label: "iCloud", action: "guide" },
    { id: "imap", label: t("reader.zeroChipImap"), action: "manual" },
  ];

  const handleQuickChip = (
    provider: ProviderId,
    action: "oauth" | "guide" | "manual",
  ) => {
    if (action === "manual") {
      workspace.setOverlay({ type: "manual-imap" });
      return;
    }
    if (action === "oauth") {
      workspace.setOverlay({
        type: "oauth-flow",
        provider,
        stage: "waiting",
      });
      return;
    }
    workspace.setOverlay({ type: "provider-guide", provider });
  };

  return (
    <FadeScroll
      className="zero-guide-stage"
      label={t("reader.zeroGuideScrollLabel")}
    >
      <div className="zero-guide-card">
        <span className="zero-guide-pill">
          <span className="zero-guide-pill-dot" aria-hidden="true" />
          <span>{t("reader.zeroGuidePill")}</span>
        </span>

        <div className="zero-guide-head">
          <h2 className="zero-guide-title">{t("reader.zeroGuideTitle")}</h2>
          <p className="zero-guide-desc">
            {t("reader.zeroGuideDesc", { profile: profileName })}
          </p>
        </div>

        <div
          className="zero-guide-grid"
          role="group"
          aria-label={t("reader.zeroGuideProvidersAria")}
        >
          {quickProviders.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="zero-guide-chip"
              onClick={() => handleQuickChip(chip.id, chip.action)}
            >
              <ProviderIcon provider={chip.id} size={18} />
              <span className="truncate">{chip.label}</span>
            </button>
          ))}
        </div>

        <div className="zero-guide-actions">
          <button
            type="button"
            className="btn btn-primary zero-guide-primary-btn"
            onClick={() => workspace.setOverlay({ type: "add-account" })}
          >
            <Icon name="plus" size={13} /> {t("reader.zeroGuideAddBtn")}
          </button>
          <button
            type="button"
            className="btn btn-secondary zero-guide-secondary-btn"
            onClick={() => workspace.setOverlay({ type: "manual-imap" })}
          >
            {t("reader.zeroGuideManualBtn")}
          </button>
        </div>

        <p className="zero-guide-footnote">
          {t("reader.zeroGuideFootnotePrefix")}
          <button
            type="button"
            className="zero-guide-inline-link"
            onClick={() =>
              workspace.setOverlay({ type: "profile-manage", mode: "switch" })
            }
          >
            {t("reader.zeroGuideSwitchLink")}
          </button>
        </p>
      </div>
    </FadeScroll>
  );
}
