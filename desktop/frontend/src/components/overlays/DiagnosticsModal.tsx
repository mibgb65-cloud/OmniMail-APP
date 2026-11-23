import { useEffect, useState } from "react";
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

export function DiagnosticsModal({ accountId }: { accountId: string }) {
  const { workspace, toastStore } = useApp();
  const acc =
    workspace.accounts.find((a) => a.id === accountId) ?? workspace.accounts[0];
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [probeStatus, setProbeStatus] = useState<AsyncActionStatus>("idle");
  const [bundleStatus, setBundleStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("正在探测链路…");

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
        title: "执行诊断失败",
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
        title: "已导出脱敏诊断包 (.zip)",
        detail: saved,
      });
    } catch (err) {
      setBundleStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: "导出诊断包失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  const logText =
    logs.length === 0
      ? "暂无同步或协议运行日志记录。"
      : logs
          .map(
            (l) =>
              `[${l.timeText}] [${l.level}] [${l.protocol}/${l.stage}] (${l.durationMs}ms) ${l.message} ${l.detail}`,
          )
          .join("\n");

  return (
    <ModalShell
      heading="连接诊断与脱敏同步日志"
      subtitle={`${acc?.name ?? "本地空间"} · 所有授权令牌与密码已强制脱敏 [REDACTED]`}
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
                idleLabel="一键重新测连"
                loadingLabel={stepLabel}
                successLabel="四步链路正常"
                errorLabel="链路异常 · 重测"
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
              idleLabel="导出脱敏诊断包"
              loadingLabel="正在打包日志…"
              successLabel="诊断包已导出"
              errorLabel="导出失败 · 重试"
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
                  title: "已复制脱敏诊断日志",
                });
              }}
            >
              <Icon name="copy" size={14} /> 复制日志
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              关闭
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
      <pre className="code-block" style={{ maxHeight: 280 }}>
        {logText}
      </pre>
    </ModalShell>
  );
}
