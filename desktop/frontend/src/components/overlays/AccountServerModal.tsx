import { useState } from "react";
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
  const acc =
    workspace.accounts.find((a) => a.id === accountId) ?? workspace.accounts[0];
  const [imapHost, setImapHost] = useState(acc?.imap.host ?? "");
  const [imapPort, setImapPort] = useState(String(acc?.imap.port ?? 993));
  const [smtpHost, setSmtpHost] = useState(acc?.smtp.host ?? "");
  const [smtpPort, setSmtpPort] = useState(String(acc?.smtp.port ?? 465));
  const [newSecret, setNewSecret] = useState("");
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("正在执行四步握手…");
  const [report, setReport] = useState<ConnectionTestReport | null>(null);

  const backToDetail = () =>
    workspace.setOverlay({ type: "settings", tab: "accounts", accountId });

  const clearErr = () => {
    if (status === "error") setStatus("idle");
  };

  const handleSave = async () => {
    if (!acc) return;
    setStatus("loading");
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
        title: "服务器参数已验证并保存",
      });
    } catch (err) {
      setStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: "更新服务器参数失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading={`编辑服务器参数 · ${acc?.name ?? ""}`}
      subtitle="留空密码则继续沿用 DPAPI 凭据盒中已保存的加密凭据"
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
            取消
          </button>
          <AsyncActionButton
            status={status}
            disabled={!imapHost.trim() || !smtpHost.trim()}
            idleLabel="测试并保存"
            loadingLabel={stepLabel}
            successLabel="握手成功 · 已保存"
            errorLabel="验证失败 · 点击重试"
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
          <label className="text-xs text-muted">IMAP 主机</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={imapHost}
            onChange={(e) => {
              setImapHost(e.target.value);
              clearErr();
            }}
          />
        </div>
        <div>
          <label className="text-xs text-muted">IMAP 端口</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={imapPort}
            onChange={(e) => {
              setImapPort(e.target.value);
              clearErr();
            }}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">SMTP 主机</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={smtpHost}
            onChange={(e) => {
              setSmtpHost(e.target.value);
              clearErr();
            }}
          />
        </div>
        <div>
          <label className="text-xs text-muted">SMTP 端口</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={smtpPort}
            onChange={(e) => {
              setSmtpPort(e.target.value);
              clearErr();
            }}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted">
          更新授权码 / 应用密码（可选）
        </label>
        <PasswordInput
          style={{ marginTop: 4 }}
          value={newSecret}
          onChange={(v) => {
            setNewSecret(v);
            clearErr();
          }}
          placeholder="不修改请留空"
          ariaLabel="更新应用密码"
        />
      </div>
    </ModalShell>
  );
}
