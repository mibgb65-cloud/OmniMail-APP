import { SendTestNotification } from "../../../bindings/omnimail/desktopservice";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function DesktopExtrasModal({ tab }: { tab: "tray" | "notifications" }) {
  const { workspace, composeStore, triggerSyncAll, toastStore } = useApp();
  const totalUnread = workspace.accounts.reduce(
    (sum, a) => sum + a.unreadCount,
    0,
  );

  return (
    <ModalShell
      heading="桌面端系统托盘与通知权限预览"
      subtitle="对应 Wails v3 原生托盘菜单与 Windows 隐私 Toast 通知集成状态"
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
              {workspace.accounts.length} 个邮箱在线 · {totalUnread} 未读
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
              workspace.setOverlay({ type: "profile-manage", mode: "switch" })
            }
          >
            <span className="row">
              <Icon name="users" size={14} /> 切换本地空间
            </span>
          </button>
        </div>
      ) : (
        <div className="settings-card">
          <div className="row-between">
            <strong style={{ fontSize: 14 }}>系统隐私通知状态</strong>
            <span
              className={`pill ${
                workspace.settings.showDesktopNotifications
                  ? "pill-success"
                  : "pill-warning"
              }`}
            >
              {workspace.settings.showDesktopNotifications
                ? "已开启"
                : "已关闭"}
            </span>
          </div>
          <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
            开启后，非黑名单的新收件将在 Windows 右下角展示「发件人 + 主题 +
            账号标签」，严格不预览敏感正文。
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                workspace.updateSettings({
                  showDesktopNotifications: true,
                  notificationPermission: "granted",
                });
                if (isWailsDesktop()) {
                  void SendTestNotification();
                }
                toastStore.pushToast({
                  tone: "success",
                  title: "已触发原生测试通知",
                  detail: "默认隐藏邮件正文摘要以保障阅读隐私",
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
