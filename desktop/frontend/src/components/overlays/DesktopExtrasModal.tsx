import { useState } from "react";
import { SendTestNotification } from "../../../bindings/omnimail/desktopservice";
import { parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function DesktopExtrasModal({ tab }: { tab: "tray" | "notifications" }) {
  const { workspace, composeStore, triggerSyncAll } = useApp();
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    error: boolean;
  }>();
  const totalUnread = workspace.accounts.reduce(
    (sum, a) => sum + a.unreadCount,
    0,
  );

  async function sendTestNotification() {
    if (!isWailsDesktop()) {
      setFeedback({
        error: true,
        message: "请在 Windows 桌面应用中发送测试通知。",
      });
      return;
    }

    setSending(true);
    setFeedback(undefined);
    try {
      await SendTestNotification();
      setFeedback({
        error: false,
        message:
          "已提交给 Windows。若没有弹出横幅，请查看通知中心，并检查 Windows 的通知横幅和勿扰设置。",
      });
    } catch (err) {
      setFeedback({
        error: true,
        message: `测试通知未发送：${parseBackendError(err).message}`,
      });
    } finally {
      setSending(false);
    }
  }

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
            <strong style={{ fontSize: 14 }}>应用内新邮件通知</strong>
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
            开启后，将非黑名单新收件的发件人、主题和账号标签提交给
            Windows，不包含邮件正文。测试通知不会改变应用或系统设置。
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={sending}
              aria-busy={sending}
              onClick={() => void sendTestNotification()}
            >
              <Icon name="bell" size={14} />
              {sending ? "正在提交给 Windows…" : "发送测试桌面通知"}
            </button>
          </div>
          {feedback && (
            <div
              className="text-xs"
              role={feedback.error ? "alert" : "status"}
              style={{
                color: feedback.error
                  ? "var(--status-danger)"
                  : "var(--text-muted)",
              }}
            >
              {feedback.message}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
