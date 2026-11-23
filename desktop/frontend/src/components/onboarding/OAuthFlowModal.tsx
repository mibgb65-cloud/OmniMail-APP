import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { PROVIDER_CATALOG } from "../../data/providers";
import { accountApi, parseBackendError } from "../../services/backendClient";
import { openSafeExternalUrl } from "../../state/desktopActions";
import { isWailsDesktop } from "../../state/storageHelpers";
import { useApp } from "../../state/AppContext";
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
  const { refreshProfilesAndAccounts, setOverlay } = workspace;
  const meta =
    PROVIDER_CATALOG.find((p) => p.id === provider) ?? PROVIDER_CATALOG[0];

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
              accountName: `${account.name}（${account.email}）`,
            });
          });
        } else {
          setStage("incomplete");
          setErrorMsg(d.errorMessage || "浏览器授权未完成或已取消");
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
      heading={`${meta.name} · 浏览器 OAuth 授权`}
      subtitle="在系统默认浏览器中完成 PKCE 授权，本机 127.0.0.1 接收令牌"
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
            返回
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                workspace.setOverlay({ type: "provider-guide", provider })
              }
            >
              改用 16 位应用专用密码
            </button>
            {authUrl && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void openSafeExternalUrl(authUrl)}
              >
                重新打开浏览器
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
            ? "正在等待系统浏览器返回授权结果…"
            : "未能通过 OAuth 启动或完成授权"}
        </div>
        <div
          className="text-xs text-muted"
          style={{ maxWidth: 400, lineHeight: 1.65 }}
        >
          {errorMsg ||
            "已在默认浏览器拉起官方登录页；若未配置 OAuth Client ID，可直接点击下方「改用 16 位应用专用密码」接入。"}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span
            className={`pill ${stage === "waiting" ? "pill-accent" : "pill-warning"}`}
          >
            <Icon
              name={stage === "waiting" ? "external" : "alertCircle"}
              size={13}
            />
            {stage === "waiting" ? "127.0.0.1 临时回调监听中" : "等待人工操作"}
          </span>
          {authUrl && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(authUrl);
                toastStore.pushToast({ tone: "info", title: "已复制授权链接" });
              }}
            >
              <Icon name="copy" size={12} /> 复制授权链接
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
