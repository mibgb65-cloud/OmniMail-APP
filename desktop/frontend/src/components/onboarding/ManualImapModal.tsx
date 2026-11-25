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
import { Checkbox } from "../common/Checkbox";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { ManualImapFields, type ManualImapFormState } from "./ManualImapFields";
import { PreparationGuideCard } from "./ProbeReportList";
import {
  ProviderConnectInfoBanner,
  ProviderConnectShell,
  ProviderSummaryCard,
  resolveAccountName,
} from "./ProviderConnectShell";

export function ManualImapModal() {
  const { workspace, toastStore } = useApp();
  const { isEn, t } = useI18n();
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
  const [pinCert, setPinCert] = useState(false);
  const [detectedCert, setDetectedCert] = useState("");
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [report, setReport] = useState<ConnectionTestReport | null>(null);

  const autoPrefill = async (val: string) => {
    if (!val.includes("@") || form.imapHost.trim()) return;
    const p = await accountApi.resolveProviderByEmail(val).catch(() => null);
    if (!p) return;
    setForm((prev) => ({
      ...prev,
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
    const display = form.displayName.trim();
    const req = {
      name: resolveAccountName(
        form.displayName,
        t("onboarding.manualSummaryName"),
        email,
      ),
      shortTag: display.slice(0, 10) || "IMAP",
      email,
      provider: "imap",
      authMode: "imap",
      secret: form.password,
      senderName: display || email.split("@")[0],
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

  const formReady =
    form.email.includes("@") &&
    Boolean(form.imapHost.trim() && form.smtpHost.trim());

  return (
    <ProviderConnectShell
      heading={t("onboarding.manualHeading")}
      footerNote={t("onboarding.manualFooterHint")}
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
          successLabel={t("onboarding.manualTestSaveSuccess")}
          errorLabel={t("onboarding.manualTestSaveError")}
          onClick={() => void handleSave()}
        />
      }
    >
      <ProviderSummaryCard
        provider="imap"
        name={t("onboarding.manualSummaryName")}
        domainHint={t("onboarding.manualSummaryDomains")}
        mode="tls"
      />
      <div className="pcm-columns">
        <PreparationGuideCard
          steps={[
            t("onboarding.manualPrepStep1"),
            t("onboarding.manualPrepStep2"),
            t("onboarding.manualPrepStep3"),
          ]}
        />
        <div className="pcm-form-col">
          <ManualImapFields
            val={form}
            onChange={(patch) => {
              setForm((p) => ({ ...p, ...patch }));
              if (status === "error") setStatus("idle");
            }}
            onEmailBlur={(val) => void autoPrefill(val)}
          />
          {detectedCert && (
            <div className="settings-card" style={{ padding: "10px 12px" }}>
              <Checkbox
                checked={pinCert}
                onChange={(v) => {
                  setPinCert(v);
                  if (status === "error") setStatus("idle");
                }}
                ariaLabel={t("onboarding.pinCertAria")}
              >
                {t("onboarding.pinCertLabel", {
                  fp: detectedCert.slice(0, 20),
                })}
              </Checkbox>
            </div>
          )}
          {status !== "idle" || report ? (
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
          ) : (
            <ProviderConnectInfoBanner />
          )}
        </div>
      </div>
    </ProviderConnectShell>
  );
}
