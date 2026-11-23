import { useState } from "react";
import { PROVIDER_CATALOG } from "../../data/providers";
import {
  accountApi,
  parseBackendError,
  type ConnectionTestReport,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { ProviderId } from "../../types/account";
import {
  AsyncActionButton,
  waitSuccessHold,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { PasswordInput } from "../common/PasswordInput";
import { ProviderStepsCard } from "./ProbeReportList";

export function ProviderGuideModal({ provider }: { provider: ProviderId }) {
  const { workspace, toastStore } = useApp();
  const meta =
    PROVIDER_CATALOG.find((p) => p.id === provider) ?? PROVIDER_CATALOG[0];

  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [imapHost, setImapHost] = useState(meta.defaultImapHost);
  const [imapPort, setImapPort] = useState(meta.defaultImapPort || 993);
  const [smtpHost, setSmtpHost] = useState(meta.defaultSmtpHost);
  const [smtpPort, setSmtpPort] = useState(meta.defaultSmtpPort || 465);
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("正在执行四步握手…");
  const [report, setReport] = useState<ConnectionTestReport | null>(null);

  const formReady =
    email.trim().includes("@") &&
    secret.trim().length >= 4 &&
    imapHost.trim().length > 0 &&
    smtpHost.trim().length > 0;

  const bindField = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    if (status === "error") setStatus("idle");
  };

  const autoResolveEmail = async (val: string) => {
    if (!val.includes("@")) return;
    const preset = await accountApi
      .resolveProviderByEmail(val)
      .catch(() => null);
    if (preset && preset.defaultImapHost) {
      setImapHost(preset.defaultImapHost);
      setImapPort(preset.defaultImapPort || 993);
      setSmtpHost(preset.defaultSmtpHost);
      setSmtpPort(preset.defaultSmtpPort || 465);
    }
  };

  const handleTestAndConnect = async () => {
    setStatus("loading");
    setReport(null);
    const req = {
      name: `${meta.name} · ${email.split("@")[0]}`,
      shortTag: meta.name,
      email: email.trim(),
      provider,
      authMode: provider === "gmail" ? "app-password" : meta.authMode,
      secret,
      senderName: email.split("@")[0],
      imapHost: imapHost.trim(),
      imapPort,
      imapSecurity: imapPort === 143 ? "STARTTLS" : "SSL/TLS",
      smtpHost: smtpHost.trim(),
      smtpPort,
      smtpSecurity: smtpPort === 587 ? "STARTTLS" : "SSL/TLS",
    };
    try {
      const probe = await accountApi.testConnection(req);
      setReport(probe);
      if (!probe.ok) {
        setStatus("error");
        return;
      }
      const created = await accountApi.addAccount({ ...req, skipProbe: true });
      setSecret(""); // 凭据已入 DPAPI Vault，立即清空前端内存
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
        title: "连接或保存账户失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading={meta.guideTitle}
      subtitle={meta.guideSummary}
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
            <Icon name="arrowLeft" size={14} /> 返回选择服务商
          </button>
          <AsyncActionButton
            status={status}
            disabled={!formReady}
            idleLabel="测试连接并接入"
            loadingLabel={stepLabel}
            successLabel="握手成功 · 已接入"
            errorLabel="认证失败 · 点击重试"
            onClick={() => void handleTestAndConnect()}
          />
        </>
      }
    >
      <ProviderStepsCard provider={provider} steps={meta.steps} />

      <HandshakeSteps
        running={status === "loading"}
        report={report}
        endpointHint={`${imapHost.trim()}:${imapPort}`}
        onStepLabelChange={setStepLabel}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">完整邮箱地址</label>
          <input
            type="email"
            className="input"
            style={{ marginTop: 4 }}
            value={email}
            onChange={(e) => bindField(setEmail)(e.target.value)}
            onBlur={(e) => void autoResolveEmail(e.target.value)}
            placeholder="请输入完整邮箱地址，例如 name@example.com"
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            客户端授权码 / 应用专用密码
          </label>
          <PasswordInput
            style={{ marginTop: 4 }}
            value={secret}
            onChange={bindField(setSecret)}
            placeholder="凭据将经 DPAPI 加密写入本地凭据盒，不落明文"
            ariaLabel="客户端授权码或应用专用密码"
          />
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">IMAP 主机 ({imapPort})</label>
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={imapHost}
              onChange={(e) => bindField(setImapHost)(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted">SMTP 主机 ({smtpPort})</label>
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={smtpHost}
              onChange={(e) => bindField(setSmtpHost)(e.target.value)}
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
