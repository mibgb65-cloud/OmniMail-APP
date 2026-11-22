import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { ModalShell } from "../common/ModalShell";

export function ManualImapModal() {
  const { workspace } = useApp();
  const [displayName, setDisplayName] = useState("企业邮箱 · IMAP");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("imap.company.example");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("smtp.company.example");
  const [smtpPort, setSmtpPort] = useState("465");
  const [security, setSecurity] = useState("SSL/TLS");

  return (
    <ModalShell
      title="手动配置 IMAP / SMTP 邮箱"
      subtitle="适用于自建邮局、企业邮箱或尚未预设的通用邮箱服务"
      maxWidth={560}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => workspace.setOverlay({ type: "add-account" })}
          >
            返回常用服务商
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              !email.includes("@") || !imapHost.trim() || !smtpHost.trim()
            }
            onClick={() =>
              workspace.setOverlay({
                type: "sync-progress",
                accountName: `${displayName}（${email}）`,
                stage: "testing",
              })
            }
          >
            测试连接并保存
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">账户显示名称</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted">邮箱地址</label>
          <input
            type="email"
            className="input"
            style={{ marginTop: 4 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.example"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted">应用密码 / 授权码</label>
        <input
          type="password"
          className="input"
          style={{ marginTop: 4 }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码将加密写入系统凭据库"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">收件服务器（IMAP）</label>
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

      <div
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}
      >
        <div>
          <label className="text-xs text-muted">发件服务器（SMTP）</label>
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
        <div>
          <label className="text-xs text-muted">加密方式</label>
          <select
            className="select"
            style={{ marginTop: 4, width: "100%" }}
            value={security}
            onChange={(e) => setSecurity(e.target.value)}
          >
            <option value="SSL/TLS">SSL/TLS</option>
            <option value="STARTTLS">STARTTLS</option>
          </select>
        </div>
      </div>
    </ModalShell>
  );
}
