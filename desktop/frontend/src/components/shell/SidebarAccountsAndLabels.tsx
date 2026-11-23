import { useApp } from "../../state/AppContext";
import type { EmailAccount } from "../../types/account";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { Tooltip } from "../common/Tooltip";

const accountStatuses: Record<EmailAccount["status"], string> = {
  connected: "已连接",
  syncing: "同步中",
  "auth-expired": "认证已过期",
  error: "连接异常",
};

export function SidebarAccountsAndLabels({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace, mailStore } = useApp();
  const { accounts } = workspace;
  const { labels, activeAccountId, activeLabelId } = mailStore;

  return (
    <>
      <div className="nav-section">
        <div className="nav-section-head">
          <span className="truncate">我的邮箱 ({accounts.length})</span>
          <button
            type="button"
            className="nav-section-action"
            onClick={() => {
              onNavigate?.();
              workspace.setOverlay({ type: "add-account" });
            }}
          >
            + 添加
          </button>
        </div>
        {accounts.length === 0 ? (
          <button
            type="button"
            className="account-empty-card"
            onClick={() => {
              onNavigate?.();
              workspace.setOverlay({ type: "add-account" });
            }}
          >
            <div className="account-empty-head">
              <span className="account-empty-plus" aria-hidden="true">
                +
              </span>
              <div className="account-empty-meta">
                <span className="account-empty-title truncate">
                  暂未接入邮箱
                </span>
                <span className="account-empty-sub truncate">
                  支持 Gmail / QQ / 163 / IMAP
                </span>
              </div>
            </div>
            <span className="account-empty-cta">+ 添加第一个邮箱</span>
          </button>
        ) : (
          accounts.map((acc) => {
            const active = activeAccountId === acc.id;
            const statusLabel = accountStatuses[acc.status] ?? "连接异常";
            return (
              <Tooltip
                key={acc.id}
                label={`${acc.email} · 点击筛选该邮箱`}
                badge={acc.unreadCount}
                placement="right"
              >
                <button
                  type="button"
                  className={`account-row ${active ? "active" : ""}`}
                  aria-pressed={active}
                  aria-label={`${acc.name}，${statusLabel}，${acc.unreadCount} 封未读`}
                  onClick={() => {
                    mailStore.selectAccount(acc.id);
                    onNavigate?.();
                  }}
                >
                  <ProviderIcon provider={acc.provider} size={28} />
                  <div className="account-row-meta">
                    <span
                      className="account-row-name truncate"
                      title={acc.name}
                    >
                      {acc.name}
                    </span>
                    <span className="account-row-sub truncate">
                      {acc.providerLabel || acc.email}
                    </span>
                  </div>
                  <div className="account-row-stats">
                    <span className="account-status-line">
                      <span
                        className="account-status-dot"
                        data-status={acc.status}
                        role="img"
                        title={statusLabel}
                        aria-label={statusLabel}
                      />
                    </span>
                    <span
                      className="account-unread-count"
                      aria-label={`${acc.unreadCount} 封未读`}
                    >
                      {acc.unreadCount}
                    </span>
                  </div>
                </button>
              </Tooltip>
            );
          })
        )}
      </div>

      <div className="sidebar-divider" />

      <div className="nav-section">
        <div className="nav-section-head">
          <span>标签</span>
          <Tooltip label="新建自定义标签" placement="right">
            <button
              type="button"
              className="nav-section-action"
              onClick={() => {
                onNavigate?.();
                workspace.setOverlay({ type: "label-manage", mode: "create" });
              }}
              aria-label="新建标签"
            >
              +
            </button>
          </Tooltip>
        </div>
        {labels.map((lbl) => (
          <button
            key={lbl.id}
            type="button"
            className={`nav-item ${activeLabelId === lbl.id ? "active" : ""}`}
            onClick={() => {
              mailStore.selectLabel(lbl.id);
              onNavigate?.();
            }}
          >
            <span className="nav-item-main">
              <span className="label-dot" style={{ background: lbl.color }} />
              <span className="nav-item-label">{lbl.name}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="nav-section">
        <button
          type="button"
          className="nav-item"
          onClick={() => {
            onNavigate?.();
            workspace.setScreen("contacts");
          }}
        >
          <span className="nav-item-main">
            <Icon name="users" size={14} />
            <span className="nav-item-label">通讯录与 VIP</span>
          </span>
          <span className="nav-count">{workspace.contacts.length}</span>
        </button>
      </div>
    </>
  );
}
