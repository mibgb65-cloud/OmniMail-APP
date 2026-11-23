import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function StatusBanner() {
  const { workspace, toastStore, triggerSyncAll } = useApp();
  const { bannerMode, settings, accounts } = workspace;
  const expiredAcc =
    accounts.find((a) => a.status === "auth-expired") ?? accounts[0];
  const failedAcc = accounts.find((a) => a.status === "error") ?? accounts[0];

  const autoReplyActive =
    settings.autoReply.enabled || bannerMode === "auto-reply";

  if (bannerMode === "none" && !autoReplyActive) return null;

  if (bannerMode === "offline") {
    return (
      <div className="runtime-banner warning" role="status">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="wifiOff" size={16} />
          <strong>当前处于离线模式 · 正在浏览本地加密缓存</strong>
          <span style={{ opacity: 0.85 }}>
            新撰写的回复将暂存于本地待发送队列，恢复联网后自动续传
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              workspace.setBannerMode("none");
              triggerSyncAll();
            }}
          >
            立即重连
          </button>
        </div>
      </div>
    );
  }

  if (bannerMode === "auth-expired") {
    return (
      <div className="runtime-banner danger" role="alert">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alertCircle" size={16} />
          <strong>{expiredAcc?.name ?? "邮箱账户"} 认证凭据已失效</strong>
          <span style={{ opacity: 0.85 }}>
            仅暂停该账户的新邮件同步，本地历史缓存仍可正常阅读与搜索
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() =>
              expiredAcc && expiredAcc.authMode !== "oauth"
                ? workspace.setOverlay({
                    type: "account-server",
                    accountId: expiredAcc.id,
                  })
                : workspace.setOverlay({
                    type: "oauth-flow",
                    provider: expiredAcc?.provider ?? "gmail",
                    stage: "waiting",
                  })
            }
          >
            重新验证授权
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => workspace.setBannerMode("none")}
          >
            稍后处理
          </button>
        </div>
      </div>
    );
  }

  if (bannerMode === "partial-sync") {
    return (
      <div className="runtime-banner warning" role="status">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alertCircle" size={16} />
          <strong>部分账户同步受阻（{failedAcc?.name ?? "邮箱账户"}）</strong>
          <span style={{ opacity: 0.85 }}>
            其余账户已正常同步，可运行连接诊断查看具体阶段错误
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() =>
              workspace.setOverlay({
                type: "diagnostics",
                accountId: failedAcc?.id ?? "",
              })
            }
          >
            运行连接诊断
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => workspace.setBannerMode("none")}
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="runtime-banner info" role="status">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Icon name="autoReply" size={16} />
        <strong>休假自动回复生效中 · 工作邮箱（Gmail）</strong>
        <span style={{ opacity: 0.88 }}>
          · {settings.autoReply.startTime} 至 {settings.autoReply.endTime} ·
          仅回复联系人与同域同事 · 已自动回复 {settings.autoReply.repliedCount}{" "}
          位来信者
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() =>
            workspace.setOverlay({ type: "settings", tab: "auto-reply" })
          }
        >
          调整回复内容
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger-soft"
          onClick={() => {
            workspace.updateSettings({
              autoReply: { ...settings.autoReply, enabled: false },
            });
            workspace.setBannerMode("none");
            toastStore.pushToast({ tone: "info", title: "已关闭休假自动回复" });
          }}
        >
          立即关闭自动回复
        </button>
      </div>
    </div>
  );
}
