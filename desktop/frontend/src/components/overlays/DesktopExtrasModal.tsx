import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function DesktopExtrasModal({ tab }: { tab: "tray" | "notifications" }) {
  const { workspace, composeStore, triggerSyncAll, toastStore } = useApp();

  return (
    <ModalShell
      title="桌面端系统托盘与通知权限预览"
      subtitle="对应 Wails v3 原生托盘菜单与 Windows / macOS 系统通知集成状态"
      maxWidth={520}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${tab === "tray" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.setOverlay({ type: "desktop-extras", tab: "tray" })
              }
            >
              系统托盘菜单
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === "notifications" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.setOverlay({
                  type: "desktop-extras",
                  tab: "notifications",
                })
              }
            >
              通知权限引导
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            关闭
          </button>
        </>
      }
    >
      {tab === "tray" ? (
        <div className="settings-card" style={{ gap: 6 }}>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <strong style={{ fontSize: 13 }}>OmniMail 系统托盘菜单</strong>
            <span className="pill pill-success">
              4 个邮箱后台在线 · 28 未读
            </span>
          </div>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              workspace.setOverlay({ type: "none" });
              composeStore.openNewCompose();
            }}
          >
            <span className="row">
              <Icon name="pen" size={14} /> 快速撰写新邮件
            </span>
            <kbd className="kbd">Ctrl N</kbd>
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              workspace.setOverlay({ type: "none" });
              triggerSyncAll();
            }}
          >
            <span className="row">
              <Icon name="refresh" size={14} /> 立即同步全部邮箱
            </span>
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "general" })
            }
          >
            <span className="row">
              <Icon name="settings" size={14} /> 打开偏好设置
            </span>
          </button>
        </div>
      ) : (
        <div className="settings-card">
          <div className="row-between">
            <strong style={{ fontSize: 14 }}>系统通知权限状态</strong>
            <span
              className={`pill ${
                workspace.settings.notificationPermission === "granted"
                  ? "pill-success"
                  : "pill-warning"
              }`}
            >
              {workspace.settings.notificationPermission === "granted"
                ? "已授权"
                : "未开启"}
            </span>
          </div>
          <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
            开启系统通知后，VIP
            发件人与核心项目组新邮件将在桌面右下角展示精简摘要，默认隐藏敏感正文内容。
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                workspace.updateSettings({ notificationPermission: "granted" });
                toastStore.pushToast({
                  tone: "success",
                  title: "已启用桌面通知提醒",
                  detail: "测试通知：来自林知夏的新邮件提醒",
                });
              }}
            >
              <Icon name="bell" size={14} /> 发送测试桌面通知
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
