import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import {
  diagnosticApi,
  mailApi,
  type RawSourceView,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ScrollCodeBlock } from "../common/scroll-fade/FadeScroll";

export { PrintExportModal } from "./PrintExportModal";

export function MailSourceModal({ mailId }: { mailId: string }) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t } = useI18n();
  const [sourceView, setSourceView] = useState<RawSourceView | null>(null);
  const mail =
    mailStore.mails.find((m) => m.id === mailId) ?? mailStore.selectedMail;

  useEffect(() => {
    if (!isWailsDesktop() || !mailId) return;
    let active = true;
    void diagnosticApi
      .getMessageRawSource(mailId)
      .then((res) => {
        if (active && res) setSourceView(res);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mailId]);

  const bodyTxt =
    mail?.messages[mail.messages.length - 1]?.bodyParagraphs.join("\n\n") ??
    mail?.snippet ??
    "";
  const fallbackRaw = mail?.rawHeaders
    ? `${mail.rawHeaders}\n\n${bodyTxt}`
    : `Subject: ${mail?.subject ?? ""}\nFrom: ${mail?.senderEmail ?? ""}\n\n${bodyTxt}`;
  const rawSource = sourceView?.rawSource || fallbackRaw;

  return (
    <ModalShell
      heading={t("overlays.sourceHeading")}
      subtitle={t("overlays.sourceSubtitle")}
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {sourceView?.truncated
              ? t("overlays.sourceTruncatedHint")
              : t("overlays.sourceVerifyHint")}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void mailApi.exportMessageEML(mailId).then(
                  (p) =>
                    p &&
                    toastStore.pushToast({
                      tone: "success",
                      title: t("toasts.exportedRawEml"),
                      detail: p,
                    }),
                );
              }}
            >
              <Icon name="download" size={14} />{" "}
              {t("overlays.sourceExportEmlBtn")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(rawSource);
                toastStore.pushToast({
                  tone: "success",
                  title: t("toasts.copiedRawSource"),
                });
              }}
            >
              <Icon name="copy" size={14} /> {t("overlays.sourceCopyAllBtn")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              {t("common.close")}
            </button>
          </div>
        </>
      }
    >
      {sourceView && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <span className="pill pill-neutral">SPF: {sourceView.spf}</span>
          <span className="pill pill-neutral">DKIM: {sourceView.dkim}</span>
          <span className="pill pill-neutral">DMARC: {sourceView.dmarc}</span>
          <span className="pill pill-neutral">
            {t("overlays.sourceHopsBadge", {
              count: sourceView.hops?.length ?? 0,
            })}
          </span>
        </div>
      )}
      <ScrollCodeBlock maxHeight={360} label={t("overlays.sourceScrollLabel")}>
        {rawSource}
      </ScrollCodeBlock>
    </ModalShell>
  );
}
