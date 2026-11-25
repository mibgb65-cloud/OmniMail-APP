import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import {
  parseBackendError,
  workBuddyMailApi,
  type ParsedBackendError,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  deriveConnectModalState,
  WORKBUDDY_OFFICIAL_GUIDE_URL,
  type WorkBuddyAuthStage,
  type WorkBuddyMailboxStatus,
} from "../../types/workbuddy";
import {
  AsyncActionButton,
  waitSuccessHold,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { PreparationGuideCard } from "./ProbeReportList";
import {
  ProviderConnectShell,
  ProviderSummaryCard,
} from "./ProviderConnectShell";
import { WorkBuddyConnectForm } from "./WorkBuddyConnectForm";

export function WorkBuddyConnectModal() {
  const { workspace, workBuddyStore, toastStore } = useApp();
  const { t } = useI18n();

  const [flowId, setFlowId] = useState("");
  const [stage, setStage] = useState<WorkBuddyAuthStage>("idle");
  const [mailboxStatus, setMailboxStatus] =
    useState<WorkBuddyMailboxStatus>("not_bound");
  const [detectedEmail, setDetectedEmail] = useState("");
  const [accountName, setAccountName] = useState(() =>
    t("workbuddy.defaultAccountName"),
  );
  const [startingAuth, setStartingAuth] = useState(false);
  const [actionStatus, setActionStatus] = useState<AsyncActionStatus>("idle");
  const [error, setError] = useState<ParsedBackendError | null>(null);

  const busy = actionStatus === "loading" || actionStatus === "success";
  const steps = [
    t("workbuddy.prepStep1"),
    t("workbuddy.prepStep2"),
    t("workbuddy.prepStep3"),
  ];

  useEffect(() => {
    if (stage !== "polling" || !flowId) return;
    let alive = true;
    const timer = window.setInterval(() => {
      void workBuddyMailApi
        .pollAuthStatus(flowId)
        .then((res) => {
          if (!alive || res.stage === "polling") return;
          setStage(res.stage);
          setMailboxStatus(res.mailboxStatus);
          if (res.stage === "authorized") {
            setDetectedEmail(res.email);
            setError(null);
          } else if (res.stage === "error" || res.stage === "timeout") {
            setError(
              parseBackendError(
                res.errorMessage ||
                  `[${res.errorCode || "ERR_WB_GATEWAY_FAILED"}]`,
              ),
            );
          }
        })
        .catch((err) => {
          if (alive) {
            setStage("error");
            setError(parseBackendError(err));
          }
        });
    }, 800);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [flowId, stage]);

  const closeModal = (backToPicker: boolean) => {
    if (busy) return;
    if (flowId && stage === "polling") {
      void workBuddyMailApi.cancelAuth(flowId);
    }
    workspace.setOverlay(
      backToPicker ? { type: "add-account" } : { type: "none" },
    );
  };

  const handleStartAuth = async () => {
    setStartingAuth(true);
    setError(null);
    setDetectedEmail("");
    if (actionStatus === "error") setActionStatus("idle");
    try {
      const started = await workBuddyMailApi.startAuth();
      setFlowId(started.flowId);
      setStage("polling");
    } catch (err) {
      setStage("error");
      setError(parseBackendError(err));
    } finally {
      setStartingAuth(false);
    }
  };

  const handleCancelAuth = async () => {
    if (flowId) await workBuddyMailApi.cancelAuth(flowId);
    setStage("idle");
    setFlowId("");
  };

  const handleCompleteConnect = async () => {
    if (!flowId) return;
    setError(null);
    setActionStatus("loading");
    try {
      const connected = await workBuddyMailApi.connectAccount(
        flowId,
        accountName.trim() || t("workbuddy.defaultAccountName"),
      );
      setActionStatus("success");
      await waitSuccessHold();
      toastStore.pushToast({
        tone: "success",
        title: t("workbuddy.connectedToast", { email: connected.email }),
      });
      workspace.setOverlay({ type: "none" });
      workBuddyStore.applyConnectedAccount(connected);
    } catch (err) {
      setError(parseBackendError(err));
      setActionStatus("error");
    }
  };

  const { canSubmit } = deriveConnectModalState({ stage, detectedEmail, busy });

  return (
    <ProviderConnectShell
      heading={t("workbuddy.connectHeading")}
      onClose={() => closeModal(false)}
      onBack={() => closeModal(true)}
      backDisabled={busy}
      footerNote={t("workbuddy.footerNote")}
      primaryAction={
        <AsyncActionButton
          className="pcm-btn-connect"
          status={actionStatus}
          disabled={!canSubmit || startingAuth}
          idleIcon="check"
          idleLabel={t("workbuddy.completeConnectBtn")}
          loadingLabel={t("workbuddy.connectingBtn")}
          successLabel={t("workbuddy.connectedBtn")}
          errorLabel={t("workbuddy.retryConnectBtn")}
          onClick={() => void handleCompleteConnect()}
        />
      }
    >
      <ProviderSummaryCard
        provider="workbuddy"
        name={t("workbuddy.providerName")}
        domainHint={t("workbuddy.providerDomain")}
        pillLabel={t("workbuddy.summaryPill")}
      />

      <div className="pcm-columns">
        <PreparationGuideCard
          provider="workbuddy"
          steps={steps}
          officialGuideUrl={WORKBUDDY_OFFICIAL_GUIDE_URL}
          footnoteText={t("workbuddy.prepFootnote")}
        />

        <WorkBuddyConnectForm
          stage={stage}
          mailboxStatus={mailboxStatus}
          detectedEmail={detectedEmail}
          accountName={accountName}
          startingAuth={startingAuth}
          busy={busy}
          error={error}
          onAccountNameChange={(val) => {
            setAccountName(val);
            if (actionStatus === "error") setActionStatus("idle");
          }}
          onStartAuth={() => void handleStartAuth()}
          onCancelAuth={() => void handleCancelAuth()}
        />
      </div>
    </ProviderConnectShell>
  );
}
