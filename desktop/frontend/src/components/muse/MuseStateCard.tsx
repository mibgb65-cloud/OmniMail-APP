import { useState } from "react";
import { useI18n } from "../../i18n";
import type { ParsedBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { openSafeExternalUrl } from "../../state/desktopActions";
import {
  MUSE_OFFICIAL_GUIDE_URL,
  type MuseViewStateKind,
} from "../../types/muse";
import { Icon, type IconName } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import {
  canBypassExternalLinkConfirm,
  inspectExternalLink,
} from "../mail/reader/externalLinkGuard";
import { ExternalLinkConfirmModal } from "../overlays/ExternalLinkConfirmModal";

export function MuseStateCard({
  kind,
  email,
  error,
  onRefresh,
  onOpenConnect,
  onDisconnect,
  onBackToMail,
}: {
  kind: Exclude<MuseViewStateKind, "ready">;
  email: string;
  error: ParsedBackendError | null;
  onRefresh: () => void;
  onOpenConnect: () => void;
  onDisconnect: () => void;
  onBackToMail: () => void;
}) {
  const { t } = useI18n();
  const { workspace } = useApp();
  const [confirmUrl, setConfirmUrl] = useState("");

  const openOfficialHelp = () => {
    const info = inspectExternalLink(MUSE_OFFICIAL_GUIDE_URL);
    if (!info) return;
    if (canBypassExternalLinkConfirm(info, workspace.activeProfileId)) {
      void openSafeExternalUrl(info.fullUrl);
      return;
    }
    setConfirmUrl(info.fullUrl);
  };

  let iconName: IconName = "inbox";
  let title = t("muse.stateEmptyTitle");
  let desc = t("muse.stateEmptyDesc", { email: email || "muse.ai" });

  if (kind === "not_enabled") {
    iconName = "mail";
    title = t("muse.stateNotEnabledTitle");
    desc = t("muse.stateNotEnabledDesc");
  } else if (kind === "auth_expired") {
    iconName = "lock";
    title = t("muse.stateAuthExpiredTitle");
    desc = t("muse.stateAuthExpiredDesc");
  } else if (kind === "identity_changed") {
    iconName = "alertCircle";
    title = t("muse.stateIdentityChangedTitle");
    desc = t("muse.stateIdentityChangedDesc");
  } else if (kind === "gateway_error") {
    iconName = "wifiOff";
    title = t("muse.stateGatewayErrorTitle");
    desc = t("muse.stateGatewayErrorDesc", {
      message: error?.message || t("errors.ERR_MUSE_GATEWAY_FAILED"),
    });
  } else if (kind === "session_cleared") {
    iconName = "lock";
    title = t("muse.stateClearedTitle");
    desc = t("muse.stateClearedDesc");
  }

  return (
    <>
      <div className="muse-state-card" role="status">
        <div className="muse-state-icon-wrap">
          {kind === "empty" || kind === "session_cleared" ? (
            <ProviderIcon provider="muse" size={38} />
          ) : (
            <span className="muse-state-glyph">
              <Icon name={iconName} size={22} />
            </span>
          )}
        </div>

        <h3 className="muse-state-title">{title}</h3>
        <p className="muse-state-desc">{desc}</p>

        {error?.code && kind === "gateway_error" && (
          <span className="pill pill-neutral muse-error-code-pill">
            {t("muse.errorCodeLabel", { code: error.code })}
          </span>
        )}

        <div className="muse-state-actions">
          {kind === "empty" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRefresh}
            >
              <Icon name="refresh" size={14} /> {t("muse.manualRefreshBtn")}
            </button>
          )}

          {kind === "gateway_error" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRefresh}
            >
              <Icon name="refresh" size={14} /> {t("muse.retryBtn")}
            </button>
          )}

          {(kind === "auth_expired" ||
            kind === "identity_changed" ||
            kind === "session_cleared") && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenConnect}
            >
              <Icon name="external" size={14} />
              <span>
                {kind === "session_cleared"
                  ? t("muse.connectMuseBtn")
                  : kind === "identity_changed"
                    ? t("muse.reverifyBtn")
                    : t("muse.reopenLoginWindowBtn")}
              </span>
            </button>
          )}

          {kind === "not_enabled" && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openOfficialHelp}
            >
              <Icon name="external" size={14} />
              <span>{t("onboarding.viewOfficialGuideBtn")}</span>
            </button>
          )}

          {kind === "session_cleared" ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onBackToMail}
            >
              {t("muse.backToMailBtn")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onDisconnect}
            >
              {t("muse.disconnectBtn")}
            </button>
          )}
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
