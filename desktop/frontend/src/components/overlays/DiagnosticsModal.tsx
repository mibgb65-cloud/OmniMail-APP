import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import {
  diagnosticApi,
  parseBackendError,
  type DiagnosticReport,
  type SyncLogEntry,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ScrollCodeBlock } from "../common/scroll-fade/FadeScroll";

export function DiagnosticsModal({ accountId }: { accountId: string }) {
  const { workspace, toastStore } = useApp();
  const { t } = useI18n();
  const acc =
    workspace.accounts.find((a) => a.id === accountId) ?? workspace.accounts[0];
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [probeStatus, setProbeStatus] = useState<AsyncActionStatus>("idle");
  const [bundleStatus, setBundleStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("");

  useEffect(() => {
    let active = true;
    void diagnosticApi
      .listSyncLogs({ accountId: acc?.id ?? "" })
      .then((rows) => {
        if (active) setLogs(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [acc?.id]);

  const handleRunDiag = async () => {
    if (!acc) return;
    setProbeStatus("loading");
    setStepLabel("");
    setReport(null);
    try {
      const rep = await diagnosticApi.runAccountDiagnostics(acc.id);
      setReport(rep);
      const rows = await diagnosticApi.listSyncLogs({ accountId: acc.id });
      setLogs(rows);
      const allOk = (rep?.steps ?? []).every((s) => s.ok);
      setProbeStatus(allOk ? "success" : "error");
    } catch (err) {
      setProbeStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.runDiagFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  const handleExportBundle = async () => {
    setBundleStatus("loading");
    try {
      const saved = await diagnosticApi.exportDiagnosticBundle();
      if (!saved) {
        setBundleStatus("idle");
        return;
      }
      setBundleStatus("success");
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.exportedDiagBundle"),
        detail: saved,
      });
    } catch (err) {
      setBundleStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.exportDiagBundleFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  const logText =
    logs.length === 0
      ? t("overlays.diagNoLogsText")
      : logs
          .map(
            (l) =>
              `[${l.timeText}] [${l.level}] [${l.protocol}/${l.stage}] (${l.durationMs}ms) ${l.message} ${l.detail}`,
          )
          .join("\n");

  return (
    <ModalShell
      heading={t("overlays.diagHeading")}
      subtitle={t("overlays.diagSubtitle", {
        name: acc?.name ?? t("overlays.diagLocalSpaceFallback"),
      })}
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <div className="row" style={{ gap: 6 }}>
            {acc && (
              <AsyncActionButton
                size="sm"
                variant="secondary"
                status={probeStatus}
                idleIcon="zap"
                idleLabel={t("overlays.diagRetestIdle")}
                loadingLabel={stepLabel || t("overlays.diagProbingStep")}
                successLabel={t("overlays.diagRetestSuccess")}
                errorLabel={t("overlays.diagRetestError")}
                successHoldMs={1000}
                onSuccessHoldEnd={() => setProbeStatus("idle")}
                onClick={() => void handleRunDiag()}
              />
            )}
            <AsyncActionButton
              size="sm"
              variant="secondary"
              status={bundleStatus}
              idleIcon="download"
              idleLabel={t("overlays.diagExportBundleIdle")}
              loadingLabel={t("overlays.diagExportBundleLoading")}
              successLabel={t("overlays.diagExportBundleSuccess")}
              errorLabel={t("overlays.backupExportRetryError")}
              successHoldMs={1000}
              onSuccessHoldEnd={() => setBundleStatus("idle")}
              onClick={() => void handleExportBundle()}
            />
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(logText);
                toastStore.pushToast({
                  tone: "success",
                  title: t("toasts.copiedDiagLogs"),
                });
              }}
            >
              <Icon name="copy" size={14} /> {t("overlays.diagCopyLogsBtn")}
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
      <HandshakeSteps
        running={probeStatus === "loading"}
        report={report}
        endpointHint={acc ? `${acc.imap.host}:${acc.imap.port}` : undefined}
        onStepLabelChange={setStepLabel}
      />
      <ScrollCodeBlock maxHeight={280} label={t("overlays.diagScrollLabel")}>
        {logText}
      </ScrollCodeBlock>
    </ModalShell>
  );
}
