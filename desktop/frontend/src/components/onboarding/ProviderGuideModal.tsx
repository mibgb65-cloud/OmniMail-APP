import { useState } from "react";
import { PROVIDER_CATALOG } from "../../data/providers";
import { useApp } from "../../state/AppContext";
import type { ProviderId } from "../../types/account";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";

export function ProviderGuideModal({ provider }: { provider: ProviderId }) {
  const { workspace } = useApp();
  const meta =
    PROVIDER_CATALOG.find((p) => p.id === provider) ?? PROVIDER_CATALOG[1];

  const [email, setEmail] = useState(
    provider === "netease"
      ? "xinghe@163.com"
      : provider === "nevermail"
        ? ""
        : `xinghe@${provider}.example`,
  );
  const [secret, setSecret] = useState("");
  const [imapHost, setImapHost] = useState(meta.defaultImapHost);
  const [smtpHost, setSmtpHost] = useState(meta.defaultSmtpHost);

  const isNeverMail = provider === "nevermail";
  const detectedNetease =
    provider === "netease" && email.toLowerCase().endsWith("@126.com")
      ? "126.com"
      : "163.com";

  const canConnect =
    email.trim().includes("@") &&
    secret.trim().length >= 4 &&
    (!isNeverMail ||
      (imapHost.trim().length > 0 && smtpHost.trim().length > 0));

  return (
    <ModalShell
      title={meta.guideTitle}
      subtitle={meta.guideSummary}
      maxWidth={560}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => workspace.setOverlay({ type: "add-account" })}
          >
            <Icon name="arrowLeft" size={14} /> 返回选择服务商
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canConnect}
            onClick={() =>
              workspace.setOverlay({
                type: "sync-progress",
                accountName: `${meta.name}（${email.trim()}）`,
                stage: "testing",
              })
            }
          >
            测试连接并接入
          </button>
        </>
      }
    >
      <div className="settings-card">
        <div className="row" style={{ gap: 10 }}>
          <ProviderIcon provider={provider} size={28} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>接入前准备步骤</div>
            <div className="text-xs text-muted">
              按以下步骤在服务商网页端获取专用凭据
            </div>
          </div>
        </div>
        <ol
          style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.75 }}
        >
          {meta.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {meta.note && (
          <div
            className="pill pill-warning"
            style={{ alignSelf: "flex-start" }}
          >
            <Icon name="info" size={13} /> {meta.note}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">完整邮箱地址</label>
          <input
            type="email"
            className="input"
            style={{ marginTop: 4 }}
            value={email}
            onChange={(e) => {
              const val = e.target.value;
              setEmail(val);
              if (provider === "netease") {
                const domain = val.toLowerCase().endsWith("@126.com")
                  ? "126.com"
                  : "163.com";
                setImapHost(`imap.${domain}`);
                setSmtpHost(`smtp.${domain}`);
              }
            }}
            placeholder="请输入邮箱地址，例如 name@example.com"
          />
          {provider === "netease" && (
            <div
              className="text-xs"
              style={{ marginTop: 4, color: "var(--brand-accent)" }}
            >
              已按邮箱后缀自动匹配网易 {detectedNetease} 服务器（imap.
              {detectedNetease}:993）
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-muted">
            {meta.authMode === "token"
              ? "客户端专用访问令牌"
              : meta.authMode === "app-password"
                ? "应用专用密码"
                : "客户端授权码 / 密码"}
          </label>
          <input
            type="password"
            className="input"
            style={{ marginTop: 4 }}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="请输入专用凭据（不会以明文记录日志）"
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">IMAP 服务器</label>
            <input
              type="text"
              className="input"
              style={{ marginTop: 4 }}
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              placeholder={
                isNeverMail
                  ? "按服务商文档填写 IMAP 主机"
                  : meta.defaultImapHost
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted">SMTP 服务器</label>
            <input
              type="text"
              className="input"
              style={{ marginTop: 4 }}
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder={
                isNeverMail
                  ? "按服务商文档填写 SMTP 主机"
                  : meta.defaultSmtpHost
              }
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
