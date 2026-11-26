import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { AsyncActionButton } from "../common/AsyncActionButton";
import { Checkbox } from "../common/Checkbox";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { SidebarLivePreviewCard } from "./AccountNamingWidgets";
import { ManualImapFields } from "./ManualImapFields";
import { PreparationGuideCard } from "./ProbeReportList";
import {
  ProviderConnectInfoBanner,
  ProviderConnectShell,
  ProviderSummaryCard,
} from "./ProviderConnectShell";
import { useManualImapController } from "./useManualImapController";

export function ManualImapModal() {
  const { workspace } = useApp();
  const { t } = useI18n();
  const c = useManualImapController();

  const formReady =
    c.form.email.includes("@") &&
    Boolean(c.form.imapHost.trim() && c.form.smtpHost.trim());

  return (
    <ProviderConnectShell
      heading={t("onboarding.manualHeading")}
      footerNote={t("onboarding.manualFooterHint")}
      backDisabled={c.status === "loading" || c.status === "success"}
      onClose={() => workspace.setOverlay({ type: "none" })}
      onBack={() => workspace.setOverlay({ type: "add-account" })}
      primaryAction={
        <AsyncActionButton
          className="pcm-btn-connect"
          idleIcon="check"
          status={c.status}
          disabled={!formReady}
          idleLabel={t("onboarding.testAndConnectBtn")}
          loadingLabel={c.stepLabel || t("common.handshakeRunningIdle")}
          successLabel={t("onboarding.manualTestSaveSuccess")}
          errorLabel={t("onboarding.manualTestSaveError")}
          onClick={() => void c.handleSave()}
        />
      }
    >
      <ProviderSummaryCard
        provider={c.detectedProvider}
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
          previewSlot={
            <SidebarLivePreviewCard
              provider={c.detectedProvider}
              displayName={c.form.displayName}
              email={c.form.email}
            />
          }
        />
        <div className="pcm-form-col">
          <ManualImapFields
            val={c.form}
            effectiveProvider={c.detectedProvider}
            detectedMxHost={c.detectedMx?.[0]}
            detectedProviderLabel={c.detectedMx?.[1]}
            onChange={(patch) => {
              c.setForm((p) => ({ ...p, ...patch }));
              if (c.status === "error") c.setStatus("idle");
            }}
            onDisplayNameChange={(displayName) => {
              c.setUserEditedName(true);
              c.setForm((p) => ({ ...p, displayName }));
              if (c.status === "error") c.setStatus("idle");
            }}
            onEmailBlur={(val) => void c.autoPrefill(val)}
          />
          {c.detectedCert && (
            <div className="settings-card" style={{ padding: "10px 12px" }}>
              <Checkbox
                checked={c.pinCert}
                onChange={(v) => {
                  c.setPinCert(v);
                  if (c.status === "error") c.setStatus("idle");
                }}
                ariaLabel={t("onboarding.pinCertAria")}
              >
                {t("onboarding.pinCertLabel", {
                  fp: c.detectedCert.slice(0, 20),
                })}
              </Checkbox>
            </div>
          )}
          {c.status !== "idle" || c.report ? (
            <HandshakeSteps
              running={c.status === "loading"}
              report={c.report}
              endpointHint={
                c.form.imapHost.trim()
                  ? `${c.form.imapHost.trim()}:${c.form.imapPort || "993"}`
                  : undefined
              }
              onStepLabelChange={c.setStepLabel}
            />
          ) : (
            <ProviderConnectInfoBanner
              description={t("onboarding.namingInfoNote")}
            />
          )}
        </div>
      </div>
    </ProviderConnectShell>
  );
}
