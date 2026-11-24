import { useState } from "react";
import { useI18n } from "../../i18n";
import {
  accountApi,
  parseBackendError,
  type ConnectionTestReport,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  AsyncActionButton,
  waitSuccessHold,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { ModalShell } from "../common/ModalShell";
import { PasswordInput } from "../common/PasswordInput";

export function AccountServerModal({ accountId }: { accountId: string }) {
  const { workspace, toastStore } = useApp();
  const { t } = useI18n();
  const acc =
    workspace.accounts.find((a) => a.id === accountId) ?? workspace.accounts[0];
  const [imapHost, setImapHost] = useState(acc?.imap.host ?? "");
  const [imapPort, setImapPort] = useState(String(acc?.imap.port ?? 993));
  const [smtpHost, setSmtpHost] = useState(acc?.smtp.host ?? "");
  const [smtpPort, setSmtpPort] = useState(String(acc?.smtp.port ?? 465));
  const [newSecret, setNewSecret] = useState("");
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [report, setReport] = useState<ConnectionTestReport | null>(null);

  const backToDetail = () =>
    workspace.setOverlay({ type: "settings", tab: "accounts", accountId });
  const bind = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    if (status === "error") setStatus("idle");
  };

  const handleSave = async () => {
    if (!acc) return;
    setStatus("loading");
    setStepLabel("");
    setReport(null);
    const iPort = Number(imapPort) || 993;
    const sPort = Number(smtpPort) || 465;
    const smtpSec = sPort === 587 ? "STARTTLS" : acc.smtp.security;
    try {
      const probe = await accountApi.testConnection({
        id: acc.id,
        name: acc.name,
        shortTag: acc.shortTag,
        email: acc.email,
        provider: acc.provider,
        authMode: acc.authMode,
        secret: newSecret,
        senderName: acc.senderName,
        imapHost: imapHost.trim(),
        imapPort: iPort,
        imapSecurity: acc.imap.security,
        smtpHost: smtpHost.trim(),
        smtpPort: sPort,
        smtpSecurity: smtpSec,
      });
      setReport(probe);
      if (!probe.ok) {
        setStatus("error");
        return;
      }
      const updated = await accountApi.updateAccount({
        id: acc.id,
        imap: {
          host: imapHost.trim(),
          port: iPort,
          security: acc.imap.security,
        },
        smtp: { host: smtpHost.trim(), port: sPort, security: smtpSec },
        secret: newSecret || undefined,
      });
      setNewSecret("");
      workspace.updateAccount(acc.id, updated);
      setStatus("success");
      await waitSuccessHold(900);
      backToDetail();
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.serverParamsSaved"),
      });
    } catch (err) {
      setStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.updateServerParamsFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading={t("overlays.serverEditHeading", { name: acc?.name ?? "" })}
      subtitle={t("overlays.serverEditSubtitle")}
      maxWidth={520}
      onClose={backToDetail}
      footer={
        <div className="row" style={{ marginLeft: "auto", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={status === "loading" || status === "success"}
            onClick={backToDetail}
          >
            {t("common.cancel")}
          </button>
          <AsyncActionButton
            status={status}
            disabled={!imapHost.trim() || !smtpHost.trim()}
            idleLabel={t("overlays.serverTestSaveIdle")}
            loadingLabel={stepLabel || t("common.handshakeRunningIdle")}
            successLabel={t("overlays.serverTestSaveSuccess")}
            errorLabel={t("overlays.serverTestSaveError")}
            onClick={() => void handleSave()}
          />
        </div>
      }
    >
      <HandshakeSteps
        running={status === "loading"}
        report={report}
        endpointHint={`${imapHost.trim()}:${imapPort || "993"}`}
        onStepLabelChange={setStepLabel}
      />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">
            {t("overlays.serverImapHostLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={imapHost}
            onChange={(e) => bind(setImapHost)(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("overlays.serverImapPortLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={imapPort}
            onChange={(e) => bind(setImapPort)(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">
            {t("overlays.serverSmtpHostLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={smtpHost}
            onChange={(e) => bind(setSmtpHost)(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("overlays.serverSmtpPortLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={smtpPort}
            onChange={(e) => bind(setSmtpPort)(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted">
          {t("overlays.serverUpdatePwdLabel")}
        </label>
        <PasswordInput
          style={{ marginTop: 4 }}
          value={newSecret}
          onChange={bind(setNewSecret)}
          placeholder={t("overlays.serverKeepPwdPlaceholder")}
          ariaLabel={t("overlays.serverUpdatePwdAria")}
        />
      </div>
    </ModalShell>
  );
}
