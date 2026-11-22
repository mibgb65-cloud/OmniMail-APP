import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { AccountDetailView } from "./AccountDetailView";

export function AccountsTab({
  selectedAccountId,
  onSelectAccount,
}: {
  selectedAccountId?: string;
  onSelectAccount: (id?: string) => void;
}) {
  const { workspace } = useApp();

  if (
    selectedAccountId &&
    workspace.accounts.some((a) => a.id === selectedAccountId)
  ) {
    return (
      <AccountDetailView
        accountId={selectedAccountId}
        onBack={() => onSelectAccount(undefined)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row-between">
        <div>
          <strong style={{ fontSize: 15 }}>
            已连接邮箱账户（{workspace.accounts.length}）
          </strong>
          <div className="text-xs text-muted">
            点击任意账户查看连接参数、签名或运行连接诊断
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => workspace.setOverlay({ type: "add-account" })}
        >
          <Icon name="plus" size={14} /> 添加邮箱
        </button>
      </div>

      {workspace.accounts.map((acc) => (
        <div
          key={acc.id}
          className="settings-card"
          style={{ cursor: "pointer" }}
          onClick={() => onSelectAccount(acc.id)}
        >
          <div className="row-between">
            <div className="row" style={{ gap: 12 }}>
              <ProviderIcon provider={acc.provider} size={30} />
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>{acc.name}</strong>
                  {workspace.settings.defaultSendAccountId === acc.id && (
                    <span className="pill pill-accent">默认发件</span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {acc.email} · 最近同步：{acc.lastSyncedAt} · 缓存{" "}
                  {acc.storageMb} MB
                </div>
              </div>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  workspace.setOverlay({
                    type: "diagnostics",
                    accountId: acc.id,
                  });
                }}
              >
                诊断
              </button>
              <Icon name="chevronRight" size={15} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
