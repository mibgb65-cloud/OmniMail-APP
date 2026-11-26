import { type ReactNode, useState } from "react";
import { useI18n } from "../../i18n";
import type { ConnectionTestReport } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { openSafeExternalUrl } from "../../state/desktopActions";
import type { ProviderId } from "../../types/account";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { Icon } from "../common/Icon";
import {
  canBypassExternalLinkConfirm,
  inspectExternalLink,
} from "../mail/reader/externalLinkGuard";
import { ExternalLinkConfirmModal } from "../overlays/ExternalLinkConfirmModal";

export function ProbeReportList({ report }: { report: ConnectionTestReport }) {
  return <HandshakeSteps running={false} report={report} />;
}

export interface PreparationGuideCardProps {
  steps: string[];
  officialGuideUrl?: string;
  provider?: ProviderId;
  footnoteText?: string;
  previewSlot?: ReactNode;
}

export function PreparationGuideCard({
  steps,
  officialGuideUrl,
  footnoteText,
  previewSlot,
}: PreparationGuideCardProps) {
  const { t } = useI18n();
  const { workspace } = useApp();
  const [confirmUrl, setConfirmUrl] = useState("");

  const handleOpenGuide = () => {
    if (!officialGuideUrl) return;
    const info = inspectExternalLink(officialGuideUrl);
    if (!info) return;
    if (canBypassExternalLinkConfirm(info, workspace.activeProfileId)) {
      void openSafeExternalUrl(info.fullUrl);
      return;
    }
    setConfirmUrl(info.fullUrl);
  };

  return (
    <>
      <div className="pcm-prep-card">
        <div className="pcm-prep-top">
          <div className="pcm-prep-head">
            <span className="pcm-prep-title">
              {t("onboarding.prepCardTitle")}
            </span>
            <span className="pcm-prep-badge">
              {t("onboarding.prepCardBadge")}
            </span>
          </div>

          <ol className="pcm-step-list">
            {steps.slice(0, 3).map((step, idx) => (
              <li key={`${idx}-${step}`} className="pcm-step-item">
                <span className="pcm-step-num">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="pcm-step-text">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="pcm-prep-bottom">
          {previewSlot}
          {officialGuideUrl && (
            <button
              type="button"
              className="btn pcm-guide-btn"
              onClick={handleOpenGuide}
            >
              <span>{t("onboarding.viewOfficialGuideBtn")}</span>
              <Icon name="external" size={14} />
            </button>
          )}
          <p className="pcm-prep-footnote">
            {footnoteText ?? t("onboarding.noAutoRedirectHint")}
          </p>
        </div>
      </div>

      {confirmUrl && (
        <ExternalLinkConfirmModal
          url={confirmUrl}
          onDismiss={() => setConfirmUrl("")}
        />
      )}
    </>
  );
}

/** 兼容旧引用的左栏 3 步准备指引卡别名 */
export const ProviderStepsCard = PreparationGuideCard;
