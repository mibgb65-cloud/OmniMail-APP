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
import { Checkbox } from "../common/Checkbox";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { ModalShell } from "../common/ModalShell";
import { ManualImapFields, type ManualImapFormState } from "./ManualImapFields";

export function ManualImapModal() {
  const { workspace, toastStore } = useApp();
  const [form, setForm] = useState<ManualImapFormState>({
    displayName: "企业邮箱 · IMAP",
    email: "",
    password: "",
    imapHost: "",
    imapPort: "993",
    smtpHost: "",
    smtpPort: "465",
    security: "SSL/TLS",
  });
  const [pinCert, setPinCert] = useState(false);
  const [detectedCert, setDetectedCert] = useState("");
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("正在执行四步握手…");
  const [report, setReport] = useState<ConnectionTestReport | null>(null);

  const autoPrefill = async (val: string) => {
    if (!val.includes("@") || form.imapHost.trim()) return;
    const preset = await accountApi
      .resolveProviderByEmail(val)
      .catch(() => null);
    if (preset) {
      setForm((prev) => ({
        ...prev,
        imapHost: preset.defaultImapHost || prev.imapHost,
        smtpHost: preset.defaultSmtpHost || prev.smtpHost,
        imapPort: String(preset.defaultImapPort || 993),
        smtpPort: String(preset.defaultSmtpPort || 465),
      }));
    }
  };

  const handleSave = async () => {
    setStatus("loading");
    setReport(null);
    const req = {
      name: form.displayName.trim() || form.email.trim(),
      shortTag: form.displayName.trim().slice(0, 10) || "IMAP",
      email: form.email.trim(),
      provider: "imap",
      authMode: "imap",
      secret: form.password,
      senderName: form.displayName.trim(),
      imapHost: form.imapHost.trim(),
      imapPort: Number(form.imapPort) || 993,
      imapSecurity: form.security,
      smtpHost: form.smtpHost.trim(),
      smtpPort: Number(form.smtpPort) || 465,
      smtpSecurity: Number(form.smtpPort) === 587 ? "STARTTLS" : form.security,
      certFingerprint: pinCert && detectedCert ? detectedCert : undefined,
    };
    try {
      const probe = await accountApi.testConnection(req);
      setReport(probe);
      if (!probe.ok) {
        if (probe.untrustedCertSha256) {
          setDetectedCert(probe.untrustedCertSha256);
        }
        setStatus("error");
        return;
      }
      const created = await accountApi.addAccount({ ...req, skipProbe: true });
      setForm((p) => ({ ...p, password: "" }));
      workspace.addAccount(created);
      await workspace.refreshProfilesAndAccounts();
      setStatus("success");
      await waitSuccessHold(900);
      workspace.setOverlay({
        type: "sync-progress",
        accountId: created.id,
        accountName: `${created.name}（${created.email}）`,
        stage: "syncing",
      });
    } catch (err) {
      setStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: "保存手动邮箱失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  const formReady =
    form.email.includes("@") &&
    Boolean(form.imapHost.trim()) &&
    Boolean(form.smtpHost.trim());

  return (
    <ModalShell
      heading="手动配置 IMAP / SMTP 邮箱"
      subtitle="适用于自建邮局、企业邮箱或通用标准协议邮箱"
      maxWidth={560}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={status === "loading" || status === "success"}
            onClick={() => workspace.setOverlay({ type: "add-account" })}
          >
            返回常用服务商
          </button>
          <AsyncActionButton
            status={status}
            disabled={!formReady}
            idleLabel="测试连接并保存"
            loadingLabel={stepLabel}
            successLabel="握手成功 · 已连接"
            errorLabel="连接未通过 · 点击重试"
            onClick={() => void handleSave()}
          />
        </>
      }
    >
      <HandshakeSteps
        running={status === "loading"}
        report={report}
        endpointHint={
          form.imapHost.trim()
            ? `${form.imapHost.trim()}:${form.imapPort || "993"}`
            : undefined
        }
        onStepLabelChange={setStepLabel}
      />
      {detectedCert && (
        <div className="settings-card" style={{ padding: "10px 12px" }}>
          <Checkbox
            checked={pinCert}
            onChange={(v) => {
              setPinCert(v);
              if (status === "error") setStatus("idle");
            }}
            ariaLabel="信任并固定此服务器自签名证书指纹"
          >
            信任并固定此服务器证书指纹（SHA-256: {detectedCert.slice(0, 20)}…）
          </Checkbox>
        </div>
      )}
      <ManualImapFields
        val={form}
        onChange={(patch) => {
          setForm((p) => ({ ...p, ...patch }));
          if (status === "error") setStatus("idle");
        }}
        onEmailBlur={(val) => void autoPrefill(val)}
      />
    </ModalShell>
  );
}
