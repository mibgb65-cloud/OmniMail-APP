import { useState } from "react";
import {
  DIAGNOSTIC_LOGS,
  DIAGNOSTIC_STEPS,
} from "../../data/rulesAndDiagnostics";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function AccountServerModal({ accountId }: { accountId: string }) {
  const { workspace, toastStore } = useApp();
  const acc =
    workspace.accounts.find((a) => a.id === accountId) ?? workspace.accounts[0];
  const [imapHost, setImapHost] = useState(acc?.imap.host ?? "");
  const [imapPort, setImapPort] = useState(String(acc?.imap.port ?? 993));
  const [smtpHost, setSmtpHost] = useState(acc?.smtp.host ?? "");
  const [smtpPort, setSmtpPort] = useState(String(acc?.smtp.port ?? 465));

  return (
    <ModalShell
      title={`编辑服务器参数 · ${acc?.name ?? ""}`}
      subtitle="修改主机或端口后将自动执行一次 TLS 握手校验"
      maxWidth={500}
      onClose={() =>
        workspace.setOverlay({ type: "settings", tab: "accounts", accountId })
      }
      footer={
        <div className="row" style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              workspace.setOverlay({
                type: "settings",
                tab: "accounts",
                accountId,
              })
            }
          >
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (acc) {
                workspace.updateAccount(acc.id, {
                  imap: {
                    ...acc.imap,
                    host: imapHost,
                    port: Number(imapPort) || 993,
                  },
                  smtp: {
                    ...acc.smtp,
                    host: smtpHost,
                    port: Number(smtpPort) || 465,
                  },
                });
              }
              workspace.setOverlay({
                type: "settings",
                tab: "accounts",
                accountId,
              });
              toastStore.pushToast({
                tone: "success",
                title: "服务器参数已保存并验证通过",
              });
            }}
          >
            保存并验证
          </button>
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">IMAP 主机</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={imapHost}
            onChange={(e) => setImapHost(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted">IMAP 端口</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={imapPort}
            onChange={(e) => setImapPort(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">SMTP 主机</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted">SMTP 端口</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={smtpPort}
            onChange={(e) => setSmtpPort(e.target.value)}
          />
        </div>
      </div>
    </ModalShell>
  );
}

export function DiagnosticsModal({ accountId }: { accountId: string }) {
  const { workspace, toastStore } = useApp();
  const acc =
    workspace.accounts.find((a) => a.id === accountId) ?? workspace.accounts[0];

  return (
    <ModalShell
      title="连接诊断与同步日志"
      subtitle={`${acc?.name ?? "邮箱账户"} · 所有授权令牌与密码已自动脱敏 [REDACTED]`}
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            诊断日志不包含任何邮件正文或凭据明文
          </span>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                toastStore.pushToast({
                  tone: "success",
                  title: "已复制脱敏诊断日志",
                })
              }
            >
              <Icon name="copy" size={14} /> 复制脱敏日志
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              关闭
            </button>
          </div>
        </>
      }
    >
      {DIAGNOSTIC_STEPS.map((st) => (
        <div
          key={st.step}
          className="settings-card"
          style={{ padding: "11px 14px" }}
        >
          <div className="row-between">
            <strong style={{ fontSize: 13 }}>{st.step}</strong>
            <div className="row">
              <span className="text-xs text-muted">{st.latency}</span>
              <span
                className={`pill ${st.status === "ok" ? "pill-success" : "pill-warning"}`}
              >
                {st.statusText}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted">{st.detail}</div>
        </div>
      ))}

      <pre className="code-block">
        {DIAGNOSTIC_LOGS.map((l) => `[${l.time}] [${l.level}] ${l.text}`).join(
          "\n",
        )}
      </pre>
    </ModalShell>
  );
}
