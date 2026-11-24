import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { PROVIDER_CATALOG } from "../../data/providers";
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
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";

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
  const rawMeta =
    PROVIDER_CATALOG.find((p) => p.id === provider) ?? PROVIDER_CATALOG[0];
  const meta = localizeProviderPreset(rawMeta, lang);

  const [flowId, setFlowId] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [stage, setStage] = useState<"waiting" | "incomplete">(initialStage);
  const [errorMsg, setErrorMsg] = useState("");

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
  }, [provider, refreshProfilesAndAccounts, setOverlay]);

  return (
    <ModalShell
      heading={t("onboarding.oauthHeading", { provider: meta.name })}
      subtitle={t("onboarding.oauthSubtitle")}
      maxWidth={520}
      onClose={() => {
        if (flowId) void accountApi.cancelOAuthFlow(flowId);
        workspace.setOverlay({ type: "none" });
      }}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => workspace.setOverlay({ type: "add-account" })}
          >
            {t("common.back")}
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                workspace.setOverlay({ type: "provider-guide", provider })
              }
            >
              {t("onboarding.use16CharAppPwd")}
            </button>
            {authUrl && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void openSafeExternalUrl(authUrl)}
              >
                {t("onboarding.reopenBrowser")}
              </button>
            )}
          </div>
        </>
      }
    >
      <div
        className="settings-card"
        style={{ alignItems: "center", textAlign: "center", padding: 22 }}
      >
        <ProviderIcon provider={provider} size={42} />
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-ink)" }}
        >
          {stage === "waiting"
            ? t("onboarding.oauthWaitingTitle")
            : t("onboarding.oauthFailedTitle")}
        </div>
        <div
          className="text-xs text-muted"
          style={{ maxWidth: 400, lineHeight: 1.65 }}
        >
          {errorMsg || t("onboarding.oauthDefaultHint")}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span
            className={`pill ${stage === "waiting" ? "pill-accent" : "pill-warning"}`}
          >
            <Icon
              name={stage === "waiting" ? "external" : "alertCircle"}
              size={13}
            />
            {stage === "waiting"
              ? t("onboarding.oauthCallbackListening")
              : t("onboarding.oauthWaitingManual")}
          </span>
          {authUrl && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(authUrl);
                toastStore.pushToast({
                  tone: "info",
                  title: t("toasts.copiedAuthUrl"),
                });
              }}
            >
              <Icon name="copy" size={12} /> {t("onboarding.copyAuthLinkBtn")}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
