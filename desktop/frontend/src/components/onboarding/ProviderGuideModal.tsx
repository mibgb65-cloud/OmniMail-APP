import { useState } from "react";
import { PROVIDER_CATALOG } from "../../data/providers";
import { localizeProviderPreset, useI18n } from "../../i18n";
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
  const { lang, isEn, t } = useI18n();
  const rawMeta =
    PROVIDER_CATALOG.find((p) => p.id === provider) ?? PROVIDER_CATALOG[0];
  const meta = localizeProviderPreset(rawMeta, lang);
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [imapHost, setImapHost] = useState(rawMeta.defaultImapHost);
  const [imapPort, setImapPort] = useState(rawMeta.defaultImapPort || 993);
  const [smtpHost, setSmtpHost] = useState(rawMeta.defaultSmtpHost);
  const [smtpPort, setSmtpPort] = useState(rawMeta.defaultSmtpPort || 465);
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [report, setReport] = useState<ConnectionTestReport | null>(null);
  const formReady =
    email.trim().includes("@") &&
    secret.trim().length >= 4 &&
    Boolean(imapHost.trim() && smtpHost.trim());
  const bindField = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    if (status === "error") setStatus("idle");
  };
  const autoResolveEmail = async (val: string) => {
    if (!val.includes("@")) return;
    const p = await accountApi.resolveProviderByEmail(val).catch(() => null);
    if (!p?.defaultImapHost) return;
    setImapHost(p.defaultImapHost);
    setImapPort(p.defaultImapPort || 993);
    setSmtpHost(p.defaultSmtpHost);
    setSmtpPort(p.defaultSmtpPort || 465);
  };
  const handleTestAndConnect = async () => {
    setStatus("loading");
    setStepLabel("");
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
      const accountName = isEn
        ? `${created.name} (${created.email})`
        : `${created.name}（${created.email}）`;
      workspace.setOverlay({
        type: "sync-progress",
        accountId: created.id,
        accountName,
      });
    } catch (err) {
      setStatus("error");
      const detail = parseBackendError(err).message;
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.connectSaveAccountFailed"),
        detail,
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
            <Icon name="arrowLeft" size={14} />{" "}
            {t("onboarding.backToProviders")}
          </button>
          <AsyncActionButton
            status={status}
            disabled={!formReady}
            idleLabel={t("onboarding.testAndConnectIdle")}
            loadingLabel={stepLabel || t("common.handshakeRunningIdle")}
            successLabel={t("onboarding.testAndConnectSuccess")}
            errorLabel={t("onboarding.testAndConnectError")}
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
          <label className="text-xs text-muted">
            {t("onboarding.fullEmailLabel")}
          </label>
          <input
            type="email"
            className="input"
            style={{ marginTop: 4 }}
            value={email}
            onChange={(e) => bindField(setEmail)(e.target.value)}
            onBlur={(e) => void autoResolveEmail(e.target.value)}
            placeholder={t("onboarding.fullEmailPlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("onboarding.authCodeOrAppPwdLabel")}
          </label>
          <PasswordInput
            style={{ marginTop: 4 }}
            value={secret}
            onChange={bindField(setSecret)}
            placeholder={t("onboarding.dpapiVaultPlaceholder")}
            ariaLabel={t("onboarding.authCodeOrAppPwdAria")}
          />
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">
              {t("onboarding.imapHostPortLabel", { port: imapPort })}
            </label>
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={imapHost}
              onChange={(e) => bindField(setImapHost)(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted">
              {t("onboarding.smtpHostPortLabel", { port: smtpPort })}
            </label>
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
