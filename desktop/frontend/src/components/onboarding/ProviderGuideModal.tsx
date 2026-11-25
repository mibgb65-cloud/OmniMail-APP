import { useState } from "react";
import { findProviderCatalogItem } from "../../data/providers";
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
import { PreparationGuideCard } from "./ProbeReportList";
import {
  ProviderConnectShell,
  ProviderSummaryCard,
  resolveAccountName,
} from "./ProviderConnectShell";
import { ProviderGuideForm } from "./ProviderGuideForm";

export function ProviderGuideModal({ provider }: { provider: ProviderId }) {
  const { workspace, toastStore } = useApp();
  const { lang, isEn, t } = useI18n();
  const rawMeta = findProviderCatalogItem(provider);
  const meta = localizeProviderPreset(rawMeta, lang);
  const [email, setEmail] = useState("");
  const [accountName, setAccountName] = useState("");
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

  const bindField =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
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
    const trimmedEmail = email.trim();
    const resolvedName = resolveAccountName(
      accountName,
      meta.name,
      trimmedEmail,
    );
    const req = {
      name: resolvedName,
      shortTag: accountName.trim().slice(0, 10) || meta.name,
      email: trimmedEmail,
      provider,
      authMode: meta.authMode === "oauth" ? "app-password" : meta.authMode,
      secret,
      senderName: accountName.trim() || trimmedEmail.split("@")[0],
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
        accountName: isEn
          ? `${created.name} (${created.email})`
          : `${created.name}（${created.email}）`,
      });
    } catch (err) {
      setStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.connectSaveAccountFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ProviderConnectShell
      heading={t("onboarding.connectHeading", { provider: meta.name })}
      backDisabled={status === "loading" || status === "success"}
      onClose={() => workspace.setOverlay({ type: "none" })}
      onBack={() => workspace.setOverlay({ type: "add-account" })}
      primaryAction={
        <AsyncActionButton
          className="pcm-btn-connect"
          idleIcon="check"
          status={status}
          disabled={!formReady}
          idleLabel={t("onboarding.testAndConnectBtn")}
          loadingLabel={stepLabel || t("common.handshakeRunningIdle")}
          successLabel={t("onboarding.testAndConnectSuccess")}
          errorLabel={t("onboarding.testAndConnectError")}
          onClick={() => void handleTestAndConnect()}
        />
      }
    >
      <ProviderSummaryCard
        provider={provider}
        name={meta.name}
        domainHint={meta.domainHint}
        mode="tls"
      />

      <div className="pcm-columns">
        <PreparationGuideCard
          provider={provider}
          steps={meta.steps}
          officialGuideUrl={meta.officialGuideUrl}
        />
        <ProviderGuideForm
          provider={provider}
          meta={meta}
          email={email}
          accountName={accountName}
          secret={secret}
          imapHost={imapHost}
          imapPort={imapPort}
          smtpHost={smtpHost}
          smtpPort={smtpPort}
          status={status}
          report={report}
          onEmailChange={bindField(setEmail)}
          onEmailBlur={(val) => void autoResolveEmail(val)}
          onAccountNameChange={bindField(setAccountName)}
          onSecretChange={bindField(setSecret)}
          onImapHostChange={bindField(setImapHost)}
          onImapPortChange={bindField(setImapPort)}
          onSmtpHostChange={bindField(setSmtpHost)}
          onSmtpPortChange={bindField(setSmtpPort)}
          onStepLabelChange={setStepLabel}
        />
      </div>
    </ProviderConnectShell>
  );
}
