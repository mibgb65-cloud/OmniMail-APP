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
import { resolveConciseProviderLabel } from "../../utils/accountDisplay";
import {
  waitSuccessHold,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { resolveAccountName } from "./ProviderConnectShell";

export function useProviderGuideController(provider: ProviderId) {
  const { workspace, toastStore } = useApp();
  const { lang, isEn, t } = useI18n();
  const rawMeta = findProviderCatalogItem(provider);
  const meta = localizeProviderPreset(rawMeta, lang);

  const [email, setEmail] = useState("");
  const [accountName, setAccountName] = useState("");
  const [userEditedName, setUserEditedName] = useState(false);
  const [detectedMx, setDetectedMx] = useState<[string, string] | null>(null);
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
    <T>(setter: (v: T) => void) =>
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
    if (p.detectedVia && p.id && p.id !== "imap") {
      const concise = resolveConciseProviderLabel(
        p.id as ProviderId,
        val,
        lang,
      );
      setDetectedMx([p.detectedVia, concise]);
      if (!userEditedName && !accountName.trim()) setAccountName(concise);
    } else {
      setDetectedMx(null);
    }
  };

  const handleTestAndConnect = async () => {
    setStatus("loading");
    setStepLabel("");
    setReport(null);
    const trimmedEmail = email.trim();
    const resolvedName = resolveAccountName(
      accountName,
      provider,
      trimmedEmail,
      lang,
    );
    const req = {
      name: resolvedName,
      shortTag: resolvedName.slice(0, 10),
      email: trimmedEmail,
      provider,
      authMode: meta.authMode === "oauth" ? "app-password" : meta.authMode,
      secret,
      senderName: trimmedEmail.split("@")[0],
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

  return {
    workspace,
    meta,
    email,
    accountName,
    detectedMx,
    secret,
    imapHost,
    imapPort,
    smtpHost,
    smtpPort,
    status,
    stepLabel,
    report,
    formReady,
    bindField,
    setEmail,
    setAccountName,
    setUserEditedName,
    setSecret,
    setImapHost,
    setImapPort,
    setSmtpHost,
    setSmtpPort,
    setStepLabel,
    autoResolveEmail,
    handleTestAndConnect,
  };
}
