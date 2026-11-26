import { useI18n } from "../../i18n";
import { museMailApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { MUSE_OFFICIAL_GUIDE_URL } from "../../types/muse";
import {
  AsyncActionButton,
  waitSuccessHold,
} from "../common/AsyncActionButton";
import { MuseConnectForm } from "./MuseConnectForm";
import { resolveInitialMuseAccountName } from "./museConnectPolling";
import { PreparationGuideCard } from "./ProbeReportList";
import {
  ProviderConnectShell,
  ProviderSummaryCard,
} from "./ProviderConnectShell";
import { useMuseLoginAutoFlow } from "./useMuseLoginAutoFlow";

export function MuseConnectModal() {
  const { workspace, museStore, toastStore } = useApp();
  const { t } = useI18n();
  const flow = useMuseLoginAutoFlow(museStore.status);

  const steps = [t("muse.prepStep1"), t("muse.prepStep2"), t("muse.prepStep3")];

  const cleanupUnboundAndClose = (backToPicker: boolean) => {
    if (flow.busy) return;
    flow.markAborted();
    if (
      !museStore.status.bound &&
      (flow.loginStage !== "idle" || flow.verifiedEmail)
    ) {
      void museMailApi.disconnect();
    }
    workspace.setOverlay(
      backToPicker ? { type: "add-account" } : { type: "none" },
    );
  };

  const handlePrimaryAction = async () => {
    if (!flow.verifiedEmail) {
      await flow.runVerifyOnce();
      return;
    }
    if (flow.verifyLockRef.current) return;
    flow.setError(null);
    flow.setActionStatus("loading");
    try {
      const boundStatus = await museMailApi.confirmConnection(
        resolveInitialMuseAccountName(flow.accountName),
      );
      flow.setActionStatus("success");
      await waitSuccessHold();
      toastStore.pushToast({
        tone: "success",
        title: t("muse.connectedToast", { email: boundStatus.verifiedEmail }),
      });
      workspace.setOverlay({ type: "none" });
      museStore.applyConnectedStatus(boundStatus);
    } catch (err) {
      flow.setError(parseBackendError(err));
      flow.setActionStatus("error");
    }
  };

  const canSubmit =
    Boolean(flow.verifiedEmail) || flow.loginStage === "login_open";

  return (
    <ProviderConnectShell
      heading={t("muse.connectHeading")}
      onClose={() => cleanupUnboundAndClose(false)}
      onBack={() => cleanupUnboundAndClose(true)}
      backDisabled={flow.busy}
      footerNote={t("muse.footerNote")}
      primaryAction={
        <AsyncActionButton
          className="pcm-btn-connect"
          status={flow.actionStatus}
          disabled={!canSubmit || flow.openingLogin}
          idleIcon="check"
          idleLabel={
            flow.verifiedEmail
              ? t("muse.confirmBindBtn")
              : t("muse.verifyAndConnectBtn")
          }
          loadingLabel={t("muse.verifyingBtn")}
          successLabel={t("muse.bindingSuccessBtn")}
          errorLabel={t("muse.verifyRetryBtn")}
          onClick={() => void handlePrimaryAction()}
        />
      }
    >
      <ProviderSummaryCard
        provider="muse"
        name={t("muse.providerName")}
        domainHint={t("muse.providerDomain")}
        pillLabel={t("muse.summaryPill")}
      />

      <div className="pcm-columns">
        <PreparationGuideCard
          provider="muse"
          steps={steps}
          officialGuideUrl={MUSE_OFFICIAL_GUIDE_URL}
          footnoteText={t("muse.prepFootnote")}
        />

        <MuseConnectForm
          loginStage={flow.loginStage}
          verifiedEmail={flow.verifiedEmail}
          accountName={flow.accountName}
          openingLogin={flow.openingLogin}
          busy={flow.busy}
          error={flow.error}
          onAccountNameChange={(val) => {
            flow.setAccountName(val);
            if (flow.actionStatus === "error") flow.setActionStatus("idle");
          }}
          onOpenLoginWindow={() => void flow.openLoginWindow()}
        />
      </div>
    </ProviderConnectShell>
  );
}
