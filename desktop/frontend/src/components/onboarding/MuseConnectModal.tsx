import { useState } from "react";
import { useI18n } from "../../i18n";
import {
  museMailApi,
  parseBackendError,
  type ParsedBackendError,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { MUSE_OFFICIAL_GUIDE_URL, type MuseLoginStage } from "../../types/muse";
import {
  AsyncActionButton,
  waitSuccessHold,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { MuseConnectForm } from "./MuseConnectForm";
import { PreparationGuideCard } from "./ProbeReportList";
import {
  ProviderConnectShell,
  ProviderSummaryCard,
} from "./ProviderConnectShell";

export function MuseConnectModal() {
  const { workspace, museStore, toastStore } = useApp();
  const { t } = useI18n();

  const [loginStage, setLoginStage] = useState<MuseLoginStage>(() =>
    museStore.status.bound ? "connected" : museStore.status.loginStage,
  );
  const [verifiedEmail, setVerifiedEmail] = useState(() =>
    museStore.status.bound ? "" : museStore.status.verifiedEmail,
  );
  const [accountName, setAccountName] = useState("");
  const [openingLogin, setOpeningLogin] = useState(false);
  const [actionStatus, setActionStatus] = useState<AsyncActionStatus>("idle");
  const [error, setError] = useState<ParsedBackendError | null>(null);

  const busy = actionStatus === "loading" || actionStatus === "success";
  const steps = [t("muse.prepStep1"), t("muse.prepStep2"), t("muse.prepStep3")];

  const cleanupUnboundAndClose = (backToPicker: boolean) => {
    if (busy) return;
    if (!museStore.status.bound && (loginStage !== "idle" || verifiedEmail)) {
      void museMailApi.disconnect();
    }
    workspace.setOverlay(
      backToPicker ? { type: "add-account" } : { type: "none" },
    );
  };

  const handleOpenLoginWindow = async () => {
    setOpeningLogin(true);
    setError(null);
    if (actionStatus === "error") setActionStatus("idle");
    try {
      const next = await museMailApi.beginConnect();
      setLoginStage(next.loginStage);
      setVerifiedEmail("");
    } catch (err) {
      if (!museStore.status.bound) setLoginStage("idle");
      setError(parseBackendError(err));
    } finally {
      setOpeningLogin(false);
    }
  };

  const handlePrimaryAction = async () => {
    setError(null);
    setActionStatus("loading");
    try {
      if (!verifiedEmail) {
        const res = await museMailApi.verifyConnection();
        setVerifiedEmail(res.email);
        setLoginStage("verified");
        setActionStatus("idle");
        return;
      }
      const boundStatus = await museMailApi.confirmConnection(accountName);
      setActionStatus("success");
      await waitSuccessHold();
      toastStore.pushToast({
        tone: "success",
        title: t("muse.connectedToast", { email: boundStatus.verifiedEmail }),
      });
      workspace.setOverlay({ type: "none" });
      museStore.applyConnectedStatus(boundStatus);
    } catch (err) {
      setError(parseBackendError(err));
      setActionStatus("error");
    }
  };

  const canSubmit = Boolean(verifiedEmail) || loginStage === "login_open";

  return (
    <ProviderConnectShell
      heading={t("muse.connectHeading")}
      onClose={() => cleanupUnboundAndClose(false)}
      onBack={() => cleanupUnboundAndClose(true)}
      backDisabled={busy}
      footerNote={t("muse.footerNote")}
      primaryAction={
        <AsyncActionButton
          className="pcm-btn-connect"
          status={actionStatus}
          disabled={!canSubmit || openingLogin}
          idleIcon="check"
          idleLabel={
            verifiedEmail
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
          loginStage={loginStage}
          verifiedEmail={verifiedEmail}
          accountName={accountName}
          openingLogin={openingLogin}
          busy={busy}
          error={error}
          onAccountNameChange={(val) => {
            setAccountName(val);
            if (actionStatus === "error") setActionStatus("idle");
          }}
          onOpenLoginWindow={() => void handleOpenLoginWindow()}
        />
      </div>
    </ProviderConnectShell>
  );
}
