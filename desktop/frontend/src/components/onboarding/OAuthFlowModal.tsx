import { PROVIDER_CATALOG } from "../../data/providers";
import { useApp } from "../../state/AppContext";
import type { ProviderId } from "../../types/account";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";

export function OAuthFlowModal({
  provider,
  stage,
}: {
  provider: ProviderId;
  stage: "waiting" | "incomplete";
}) {
  const { workspace } = useApp();
  const meta =
    PROVIDER_CATALOG.find((p) => p.id === provider) ?? PROVIDER_CATALOG[0];

  return (
    <ModalShell
      title={`${meta.name} · 浏览器 OAuth 授权`}
      subtitle="在系统默认浏览器中完成登录，OmniMail 仅接收加密授权令牌"
      maxWidth={500}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => workspace.setOverlay({ type: "add-account" })}
          >
            返回
          </button>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                workspace.setOverlay({
                  type: "oauth-flow",
                  provider,
                  stage: stage === "waiting" ? "incomplete" : "waiting",
                })
              }
            >
              {stage === "waiting" ? "模拟授权中断" : "重新拉起浏览器"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                workspace.setOverlay({
                  type: "sync-progress",
                  accountName: `${meta.name} · OAuth 账户`,
                  stage: "testing",
                })
              }
            >
              已完成授权，继续同步
            </button>
          </div>
        </>
      }
    >
      <div
        className="settings-card"
        style={{ alignItems: "center", textAlign: "center", padding: 24 }}
      >
        <ProviderIcon provider={provider} size={44} />
        <div
          style={{ fontSize: 16, fontWeight: 700, color: "var(--text-ink)" }}
        >
          {stage === "waiting"
            ? "正在等待浏览器返回授权结果…"
            : "浏览器授权未完成或已取消"}
        </div>
        <div
          className="text-xs text-muted"
          style={{ maxWidth: 380, lineHeight: 1.65 }}
        >
          {stage === "waiting"
            ? "已在默认浏览器打开官方授权页面。如未自动弹出，可重新拉起或切换为手动 IMAP / 应用密码接入。"
            : "未能收到有效的 OAuth 回调令牌。请确认已完成范围勾选并允许回跳本地安全端口，或改用手动 IMAP 配置。"}
        </div>
        <span
          className={`pill ${stage === "waiting" ? "pill-accent" : "pill-warning"}`}
        >
          <Icon
            name={stage === "waiting" ? "external" : "alertCircle"}
            size={13}
          />
          {stage === "waiting"
            ? "安全回调端口监听中 (127.0.0.1)"
            : "授权状态：未完成"}
        </span>
      </div>
    </ModalShell>
  );
}
