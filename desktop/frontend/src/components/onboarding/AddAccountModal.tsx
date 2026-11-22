import { PROVIDER_CATALOG } from "../../data/providers";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";

export function AddAccountModal() {
  const { workspace } = useApp();

  return (
    <ModalShell
      title="添加邮箱账户"
      subtitle="选择常用邮箱服务商；163 / 126 已合并至网易邮箱入口，按邮箱后缀自动识别"
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => workspace.setOverlay({ type: "manual-imap" })}
          >
            <Icon name="server" size={14} /> 其他邮箱 · 手动 IMAP / SMTP
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            关闭
          </button>
        </>
      }
    >
      <div className="provider-grid">
        {PROVIDER_CATALOG.map((item) => (
          <button
            key={item.id}
            type="button"
            className="provider-card"
            onClick={() => {
              if (item.authMode === "oauth") {
                workspace.setOverlay({
                  type: "oauth-flow",
                  provider: item.id,
                  stage: "waiting",
                });
              } else {
                workspace.setOverlay({
                  type: "provider-guide",
                  provider: item.id,
                });
              }
            }}
          >
            <div className="row" style={{ gap: 11, minWidth: 0 }}>
              <ProviderIcon provider={item.id} size={32} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "var(--text-ink)",
                  }}
                >
                  {item.name}
                </div>
                <div className="text-xs text-muted truncate">
                  {item.subtitle}
                </div>
              </div>
            </div>
            <span
              className={`pill ${
                item.badgeTone === "blue"
                  ? "pill-accent"
                  : item.badgeTone === "violet"
                    ? "pill-ai"
                    : item.badgeTone === "amber"
                      ? "pill-warning"
                      : "pill-neutral"
              }`}
              style={{ flexShrink: 0 }}
            >
              {item.badgeText}
            </span>
          </button>
        ))}
      </div>

      <div className="settings-card">
        <div
          className="row"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--text-ink)" }}
        >
          <Icon name="info" size={15} />
          <span>邮箱识别与预设边界说明</span>
        </div>
        <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
          • <strong>网易邮箱（163 / 126）</strong>
          共用同一接入入口，将依据输入的邮箱后缀自动填充对应 IMAP/SMTP 服务器。
          <br />• <strong>Never Mail</strong>{" "}
          保持中性接入形态，不预设未核实的官方域名或端口，接入时请按服务商文档填写。
          <br />•
          仅在接入后将授权令牌或客户端授权码写入本机加密凭据库，不保存网页登录密码。
        </div>
      </div>
    </ModalShell>
  );
}
