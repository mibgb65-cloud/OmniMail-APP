import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { EmailAccount } from "../../types/account";
import { ActionMenu } from "../common/ActionMenu";
import { Icon } from "../common/Icon";
import { AccountRenamePopover } from "./AccountRenamePopover";
import { SidebarAccountRow } from "./SidebarAccountRow";

export function SidebarAccountSection({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace, mailStore, triggerSyncAccount } = useApp();
  const { t } = useI18n();
  const { accounts } = workspace;
  const { activeAccountId } = mailStore;

  const [renaming, setRenaming] = useState<{
    account: EmailAccount;
    rect: DOMRect;
  } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    account: EmailAccount;
    x: number;
    y: number;
    rowRect: DOMRect;
  } | null>(null);

  return (
    <div className="nav-section">
      <div className="nav-section-head">
        <span className="truncate">
          {t("sidebar.accounts")} ({accounts.length})
        </span>
        <button
          type="button"
          className="nav-section-action"
          onClick={() => {
            onNavigate?.();
            workspace.setOverlay({ type: "add-account" });
          }}
        >
          <Icon name="plus" size={12} /> {t("sidebar.addAccountBtn")}
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
              <Icon name="plus" size={16} />
            </span>
            <div className="account-empty-meta">
              <span className="account-empty-title truncate">
                {t("sidebar.noAccountsTitle")}
              </span>
              <span className="account-empty-sub truncate">
                {t("sidebar.noAccountsSub")}
              </span>
            </div>
          </div>
          <span className="account-empty-cta">
            <Icon name="plus" size={12} /> {t("sidebar.addFirstAccount")}
          </span>
        </button>
      ) : (
        accounts.map((acc) => (
          <SidebarAccountRow
            key={acc.id}
            account={acc}
            active={workspace.screen === "mail" && activeAccountId === acc.id}
            isRenaming={renaming?.account.id === acc.id}
            onNavigate={onNavigate}
            onOpenRename={(rect) => setRenaming({ account: acc, rect })}
            onOpenContextMenu={(x, y, rowRect) =>
              setCtxMenu({ account: acc, x, y, rowRect })
            }
          />
        ))
      )}

      {ctxMenu && (
        <ActionMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          minWidth={184}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              label: t("sidebar.renameAccountBtn"),
              icon: "pencil",
              onSelect: () =>
                setRenaming({
                  account: ctxMenu.account,
                  rect: ctxMenu.rowRect,
                }),
            },
            {
              label: t("sidebar.syncAccountNowMenu"),
              icon: "refresh",
              onSelect: () => triggerSyncAccount(ctxMenu.account.id),
            },
            { type: "divider" },
            {
              label: t("sidebar.accountSettingsMenu"),
              icon: "settings",
              onSelect: () =>
                workspace.setOverlay({
                  type: "settings",
                  tab: "accounts",
                }),
            },
          ]}
        />
      )}

      {renaming && (
        <AccountRenamePopover
          account={renaming.account}
          anchorRect={renaming.rect}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  );
}
