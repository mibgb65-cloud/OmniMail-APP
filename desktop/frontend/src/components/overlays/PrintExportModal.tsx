import { useState } from "react";
import { useI18n } from "../../i18n";
import { mailApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function PrintExportModal({ mailId }: { mailId: string }) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t, localizeText } = useI18n();
  const mail =
    mailStore.mails.find((m) => m.id === mailId) ?? mailStore.selectedMail;
  const [format, setFormat] = useState<"pdf" | "eml">("eml");
  const [includeQuoted, setIncludeQuoted] = useState(true);

  const handleConfirm = async () => {
    if (format === "pdf") {
      workspace.setOverlay({ type: "none" });
      window.setTimeout(() => window.print(), 120);
      return;
    }
    try {
      const saved = await mailApi.exportMessageEML(mailId);
      workspace.setOverlay({ type: "none" });
      if (saved) {
        toastStore.pushToast({
          tone: "success",
          title: t("toasts.exportedStdEml"),
          detail: saved,
        });
      }
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.exportMailFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading={t("overlays.printHeading")}
      subtitle={
        mail?.subject
          ? localizeText(mail.subject)
          : t("overlays.printCurrentMailFallback")
      }
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {t("overlays.printFooterHint")}
          </span>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleConfirm()}
            >
              <Icon name="printer" size={14} />{" "}
              {format === "pdf"
                ? t("overlays.printSystemPdfBtn")
                : t("overlays.printExportEmlBtn")}
            </button>
          </div>
        </>
      }
    >
      <div className="settings-card">
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${format === "eml" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFormat("eml")}
          >
            {t("overlays.printFormatEmlBtn")}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${format === "pdf" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFormat("pdf")}
          >
            {t("overlays.printFormatPdfBtn")}
          </button>
        </div>
        <Checkbox
          checked={includeQuoted}
          onChange={setIncludeQuoted}
          ariaLabel={t("overlays.printIncludeThreadLabel")}
        >
          {t("overlays.printIncludeThreadLabel")}
        </Checkbox>
      </div>
    </ModalShell>
  );
}
