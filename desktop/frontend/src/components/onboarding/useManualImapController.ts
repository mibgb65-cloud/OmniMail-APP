import { useState } from "react";
import { useI18n } from "../../i18n";
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
import type { ManualImapFormState } from "./ManualImapFields";
import { resolveAccountName } from "./ProviderConnectShell";

export function useManualImapController() {
  const { workspace, toastStore } = useApp();
  const { lang, isEn, t } = useI18n();
  const [form, setForm] = useState<ManualImapFormState>({
    displayName: "",
    email: "",
    password: "",
    imapHost: "",
    imapPort: "993",
    smtpHost: "",
    smtpPort: "465",
    security: "SSL/TLS",
  });
  const [detectedProvider, setDetectedProvider] = useState<ProviderId>("imap");
  const [detectedMx, setDetectedMx] = useState<[string, string] | null>(null);
  const [userEditedName, setUserEditedName] = useState(false);
  const [pinCert, setPinCert] = useState(false);
  const [detectedCert, setDetectedCert] = useState("");
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [report, setReport] = useState<ConnectionTestReport | null>(null);

  const autoPrefill = async (val: string) => {
    if (!val.includes("@")) return;
    const p = await accountApi.resolveProviderByEmail(val).catch(() => null);
    if (!p) return;
    const matchedId = (p.id || "imap") as ProviderId;
    const concise = resolveConciseProviderLabel(matchedId, val, lang);
    setDetectedProvider(matchedId);
    setDetectedMx(
      p.detectedVia && matchedId !== "imap" ? [p.detectedVia, concise] : null,
    );
    setForm((prev) => ({
      ...prev,
      displayName:
        !userEditedName && !prev.displayName.trim() && matchedId !== "imap"
          ? concise
          : prev.displayName,
      imapHost: p.defaultImapHost || prev.imapHost,
      smtpHost: p.defaultSmtpHost || prev.smtpHost,
      imapPort: String(p.defaultImapPort || 993),
      smtpPort: String(p.defaultSmtpPort || 465),
    }));
  };

  const handleSave = async () => {
    setStatus("loading");
    setStepLabel("");
    setReport(null);
    const email = form.email.trim();
    const name = resolveAccountName(
      form.displayName,
      detectedProvider,
      email,
      lang,
    );
    const imapPort = Number(form.imapPort) || 993;
    const smtpPort = Number(form.smtpPort) || 465;
    const req = {
      name,
      shortTag: name.slice(0, 10),
      email,
      provider: detectedProvider,
      authMode: detectedProvider === "imap" ? "imap" : "app-password",
      secret: form.password,
      senderName: email.split("@")[0],
      imapHost: form.imapHost.trim(),
      imapPort,
      imapSecurity: form.security,
      smtpHost: form.smtpHost.trim(),
      smtpPort,
      smtpSecurity: smtpPort === 587 ? "STARTTLS" : form.security,
      certFingerprint: pinCert && detectedCert ? detectedCert : undefined,
    };
    try {
      const probe = await accountApi.testConnection(req);
      setReport(probe);
      if (!probe.ok) {
        if (probe.untrustedCertSha256)
          setDetectedCert(probe.untrustedCertSha256);
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
        accountName: isEn
          ? `${created.name} (${created.email})`
          : `${created.name}（${created.email}）`,
      });
    } catch (err) {
      setStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.saveManualImapFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  return {
    form,
    setForm,
    detectedProvider,
    detectedMx,
    setUserEditedName,
    pinCert,
    setPinCert,
    detectedCert,
    status,
    setStatus,
    stepLabel,
    setStepLabel,
    report,
    autoPrefill,
    handleSave,
  };
}
