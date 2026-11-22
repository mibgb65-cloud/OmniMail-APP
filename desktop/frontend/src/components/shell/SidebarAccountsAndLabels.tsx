import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";

export function SidebarAccountsAndLabels({
  onNavigate,
  compactSingleLine = false,
}: {
  onNavigate?: () => void;
  compactSingleLine?: boolean;
}) {
  const { viewport, workspace, mailStore } = useApp();
  const { accounts } = workspace;
  const { labels, activeAccountId, activeLabelId } = mailStore;
  const singleLine = compactSingleLine || viewport === "laptop";

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
        {accounts.map((acc) => {
          const active = activeAccountId === acc.id;
          return (
            <button
              key={acc.id}
              type="button"
              className={`account-row ${active ? "active" : ""}`}
              onClick={() => {
                mailStore.selectAccount(acc.id);
                onNavigate?.();
              }}
              title={`${acc.email}（点击筛选该邮箱）`}
            >
              <div className="account-row-left">
                <ProviderIcon
                  provider={acc.provider}
                  size={singleLine ? 20 : 24}
                />
                <div className="account-row-meta">
                  <span className="account-row-name">
                    <span className="truncate">
                      {singleLine
                        ? `${acc.name} · ${acc.providerLabel}`
                        : acc.name}
                    </span>
                    <span
                      className={`status-dot ${acc.status === "auth-expired" ? "danger" : ""}`}
                      style={{ width: 6, height: 6 }}
                    />
                  </span>
                  {!singleLine && (
                    <span className="account-row-sub truncate">
                      {acc.providerLabel}
                    </span>
                  )}
                </div>
              </div>
              <span className="nav-count">{acc.unreadCount}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-divider" />

      <div className="nav-section">
        <div className="nav-section-head">
          <span>标签</span>
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
