import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { openSafeExternalUrl } from "../../state/desktopActions";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { Tooltip } from "../common/Tooltip";
import {
  inspectExternalLink,
  trustDomain,
} from "../mail/reader/externalLinkGuard";
import {
  ExternalLinkModalBody,
  getExternalLinkHeaderKeys,
} from "./ExternalLinkModalBody";

export function ExternalLinkConfirmModal({
  url,
  displayText,
  mailDanger,
  onDismiss,
}: {
  url: string;
  displayText?: string;
  mailDanger?: boolean;
  onDismiss?: () => void;
}) {
  const { workspace, toastStore } = useApp();
  const { t } = useI18n();
  const [trustChecked, setTrustChecked] = useState(false);
  const safeBackRef = useRef<HTMLButtonElement | null>(null);
  const info = useMemo(
    () => inspectExternalLink(url, { displayText, mailDanger }),
    [url, displayText, mailDanger],
  );
  const isDanger = info?.risk === "danger";

  useEffect(() => {
    if (!info) {
      if (onDismiss) onDismiss();
      else workspace.setOverlay({ type: "none" });
    }
  }, [info, onDismiss, workspace]);

  useEffect(() => {
    if (!onDismiss) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onDismiss]);

  useEffect(() => {
    if (isDanger) safeBackRef.current?.focus();
  }, [isDanger]);

  if (!info) return null;

  const close = () => {
    if (onDismiss) onDismiss();
    else workspace.setOverlay({ type: "none" });
  };
  const [titleKey, subKey] = getExternalLinkHeaderKeys(info);

  const handleCopy = () => {
    if (!navigator.clipboard?.writeText) {
      toastStore.pushToast({
        tone: "warning",
        title: t("externalLink.copyFailedToast"),
      });
      return;
    }
    void navigator.clipboard
      .writeText(info.fullUrl)
      .then(() =>
        toastStore.pushToast({
          tone: "success",
          title: t("externalLink.copiedToast"),
        }),
      )
      .catch(() =>
        toastStore.pushToast({
          tone: "warning",
          title: t("externalLink.copyFailedToast"),
        }),
      );
  };

  const handleProceed = () => {
    if (info.canTrust && trustChecked) {
      trustDomain(workspace.activeProfileId, info.hostname);
    }
    close();
    void openSafeExternalUrl(info.fullUrl);
  };

  const footer = isDanger ? (
    <>
      <button
        type="button"
        className="ext-link-risk-btn"
        onClick={handleProceed}
      >
        {t("externalLink.riskProceedBtn")}
      </button>
      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn btn-secondary ext-link-btn"
          onClick={handleCopy}
        >
          {t("externalLink.copyLinkBtn")}
        </button>
        <button
          ref={safeBackRef}
          type="button"
          className="btn btn-primary ext-link-btn"
          onClick={close}
        >
          {t("externalLink.safeBackBtn")}
        </button>
      </div>
    </>
  ) : (
    <>
      <button
        type="button"
        className="btn btn-secondary ext-link-btn"
        onClick={handleCopy}
      >
        <Icon name="copy" size={13} />
        {t("externalLink.copyLinkBtn")}
      </button>
      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn btn-secondary ext-link-btn"
          onClick={close}
        >
          {t("externalLink.cancelBtn")}
        </button>
        <button
          type="button"
          className="btn btn-primary ext-link-btn"
          onClick={handleProceed}
        >
          {t("externalLink.continueBtn")}
          <Icon name="external" size={12} />
        </button>
      </div>
    </>
  );

  return (
    <ModalShell
      maxWidth={520}
      noPadding
      ariaLabel={t(titleKey)}
      backdropClassName={onDismiss ? "is-stacked" : undefined}
      cardClassName={`ext-link-modal-card${isDanger ? " is-danger" : ""}`}
      onClose={close}
      footer={footer}
    >
      <div className="ext-link-header">
        <div className="ext-link-header-left">
          <span className="ext-link-badge" aria-hidden="true">
            <Icon name={isDanger ? "shieldWarning" : "external"} size={18} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 className="ext-link-title">{t(titleKey)}</h2>
            <p className="ext-link-sub">{t(subKey)}</p>
          </div>
        </div>
        <Tooltip label={t("common.closeModal")} shortcut="Esc">
          <button
            type="button"
            className="icon-btn ext-link-close"
            onClick={close}
            aria-label={t("common.closeModal")}
          >
            <Icon name="x" size={13} />
          </button>
        </Tooltip>
      </div>

      <ExternalLinkModalBody
        info={info}
        trustChecked={trustChecked}
        onTrustChange={setTrustChecked}
      />
    </ModalShell>
  );
}
