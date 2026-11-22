import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";

export function AccountDetailView({
  accountId,
  onBack,
}: {
  accountId: string;
  onBack: () => void;
}) {
  const { workspace, toastStore } = useApp();
  const detail = workspace.accounts.find((a) => a.id === accountId);
  if (!detail) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: "flex-start" }}
        onClick={onBack}
      >
        <Icon name="arrowLeft" size={14} /> 返回邮箱账户列表
      </button>

      <div className="settings-card">
        <div className="row-between">
          <div className="row" style={{ gap: 12 }}>
            <ProviderIcon provider={detail.provider} size={36} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.name}</div>
              <div className="text-xs text-muted">{detail.email}</div>
            </div>
          </div>
          <span
            className={`pill ${
              detail.status === "connected"
                ? "pill-success"
                : detail.status === "auth-expired"
                  ? "pill-danger"
                  : "pill-warning"
            }`}
          >
            {detail.status === "connected"
              ? "连接正常"
              : detail.status === "auth-expired"
                ? "授权已失效"
                : "正在同步"}
          </span>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>发件显示名称</div>
            <div className="text-xs text-muted">{detail.senderName}</div>
          </div>
          <span className="pill pill-neutral">
            {detail.authMode === "oauth"
              ? "浏览器 OAuth 令牌"
              : "客户端授权码 / IMAP"}
          </span>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              IMAP / SMTP 服务器参数
            </div>
            <div className="text-xs text-muted">
              IMAP: {detail.imap.host}:{detail.imap.port} · SMTP:{" "}
              {detail.smtp.host}:{detail.smtp.port}（{detail.imap.security}）
            </div>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                workspace.setOverlay({
                  type: "account-server",
                  accountId: detail.id,
                })
              }
            >
              编辑参数
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                workspace.setOverlay({
                  type: "diagnostics",
                  accountId: detail.id,
                })
              }
            >
              连接诊断与日志
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>邮箱签名</div>
            <div
              className="text-xs text-muted"
              style={{ whiteSpace: "pre-line", marginTop: 3 }}
            >
              {detail.signature}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              toastStore.pushToast({
                tone: "success",
                title: "账户凭据校验正常",
                detail: `最近同步：${detail.lastSyncedAt} · 缓存占用 ${detail.storageMb} MB`,
              })
            }
          >
            测试连接
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 13, color: "var(--status-danger)" }}>
              移除此邮箱账户
            </strong>
            <div className="text-xs text-muted">
              仅移除本地缓存、搜索索引与系统凭据库中的令牌，不影响云端原始邮件
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              workspace.setOverlay({
                type: "danger-confirm",
                kind: "remove-account",
                targetId: detail.id,
                targetLabel: detail.name,
              })
            }
          >
            移除账户
          </button>
        </div>
      </div>
    </div>
  );
}
