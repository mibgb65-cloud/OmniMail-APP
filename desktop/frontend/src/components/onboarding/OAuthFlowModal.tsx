import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { findProviderCatalogItem } from "../../data/providers";
import {
  getCurrentLanguage,
  localizeProviderPreset,
  t as translateNow,
  useI18n,
} from "../../i18n";
import { accountApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { openSafeExternalUrl } from "../../state/desktopActions";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { ProviderId } from "../../types/account";
import { Icon } from "../common/Icon";
import { OAuthStatusColumn } from "./OAuthStatusColumn";
import { PreparationGuideCard } from "./ProbeReportList";
import {
  ProviderConnectShell,
  ProviderSummaryCard,
} from "./ProviderConnectShell";

export function OAuthFlowModal({
  provider,
  stage: initialStage,
}: {
  provider: ProviderId;
  stage: "waiting" | "incomplete";
}) {
  const { workspace, toastStore } = useApp();
  const { lang, t } = useI18n();
  const { refreshProfilesAndAccounts, setOverlay } = workspace;
  const rawMeta = findProviderCatalogItem(provider);
  const meta = localizeProviderPreset(rawMeta, lang);

  const [flowId, setFlowId] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [stage, setStage] = useState<"waiting" | "incomplete">(initialStage);
  const [errorMsg, setErrorMsg] = useState("");
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let activeFlow = "";
    let mounted = true;
    void accountApi
      .startOAuthFlow(provider)
      .then((res) => {
        if (!mounted) {
          void accountApi.cancelOAuthFlow(res.flowId);
          return;
        }
        activeFlow = res.flowId;
        setFlowId(res.flowId);
        setAuthUrl(res.authUrl);
        setStage("waiting");
        setErrorMsg("");
      })
      .catch((err) => {
        if (!mounted) return;
        setStage("incomplete");
        setErrorMsg(parseBackendError(err).message);
      });

    let off: () => void = () => {};
    if (isWailsDesktop()) {
      off = Events.On("omnimail:account:oauth-result", (ev) => {
        const d = ev.data as
          | {
              flowId?: string;
              ok?: boolean;
              account?: { id: string; name: string; email: string };
              errorMessage?: string;
            }
          | undefined;
        if (!d || (activeFlow && d.flowId !== activeFlow)) return;
        if (d.ok && d.account) {
          const account = d.account;
          void refreshProfilesAndAccounts().then(() => {
            if (!mounted) return;
            setOverlay({
              type: "sync-progress",
              accountId: account.id,
              accountName:
                getCurrentLanguage() === "en-US"
                  ? `${account.name} (${account.email})`
                  : `${account.name}（${account.email}）`,
            });
          });
        } else {
          setStage("incomplete");
          setErrorMsg(
            d.errorMessage || translateNow("onboarding.oauthCancelledFallback"),
          );
        }
      });
    }

    return () => {
      mounted = false;
      off();
      if (activeFlow) void accountApi.cancelOAuthFlow(activeFlow);
    };
  }, [provider, refreshProfilesAndAccounts, retryTick, setOverlay]);

  const cancelAndClose = () => {
    if (flowId) void accountApi.cancelOAuthFlow(flowId);
    workspace.setOverlay({ type: "none" });
  };

  return (
    <ProviderConnectShell
      heading={t("onboarding.connectHeading", { provider: meta.name })}
      onClose={cancelAndClose}
      onBack={() => {
        if (flowId) void accountApi.cancelOAuthFlow(flowId);
        workspace.setOverlay({ type: "add-account" });
      }}
      primaryAction={
        <button
          type="button"
          className="btn btn-primary pcm-btn-connect"
          onClick={() => {
            if (authUrl) {
              void openSafeExternalUrl(authUrl);
            } else {
              setRetryTick((n) => n + 1);
            }
          }}
        >
          <Icon name="external" size={14} />
          <span>{t("onboarding.reopenBrowser")}</span>
        </button>
      }
    >
      <ProviderSummaryCard
        provider={provider}
        name={meta.name}
        domainHint={meta.domainHint}
        mode="oauth"
      />

      <div className="pcm-columns">
        <PreparationGuideCard
          provider={provider}
          steps={meta.oauthSteps ?? meta.steps}
          officialGuideUrl={meta.officialGuideUrl}
        />

        <OAuthStatusColumn
          stage={stage}
          authUrl={authUrl}
          errorMsg={errorMsg}
          onSwitchAppPassword={() => {
            if (flowId) void accountApi.cancelOAuthFlow(flowId);
            workspace.setOverlay({ type: "provider-guide", provider });
          }}
          onCopyLink={() => {
            void navigator.clipboard?.writeText(authUrl);
            toastStore.pushToast({
              tone: "info",
              title: t("toasts.copiedAuthUrl"),
            });
          }}
        />
      </div>
    </ProviderConnectShell>
  );
}
