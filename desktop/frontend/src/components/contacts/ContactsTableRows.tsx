import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { useValuePresence } from "../../state/usePresence";
import type { ContactItem } from "../../types/workspace";
import { ActionMenu } from "../common/ActionMenu";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export function ContactsTableRows({
  contacts,
  selectedId,
  onSelect,
}: {
  contacts: ContactItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { viewport, workspace, composeStore, toastStore } = useApp();
  const [menuState, setMenuState] = useState<{
    contact: ContactItem;
    left: number;
    top: number;
  } | null>(null);
  const { rendered: activeMenu, closing } = useValuePresence(menuState, 100);
  const isCompact = viewport === "compact";

  return (
    <>
      <div className="contacts-table-head">
        <span>联系人与邮箱</span>
        <span>{isCompact ? "组织与分组" : "公司 / 职位"}</span>
        <span>来源账户</span>
        {!isCompact && <span>分组</span>}
        <span>往来频率</span>
        <span style={{ textAlign: "right" }}>快捷操作</span>
      </div>

      <div className="contacts-rows-scroll">
        {contacts.map((c) => (
          <div
            key={c.id}
            className={`contacts-table-row${selectedId === c.id ? " selected" : ""}`}
            onClick={() => onSelect(c.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuState({ contact: c, left: e.clientX, top: e.clientY });
            }}
          >
            <div className="row" style={{ gap: 9, minWidth: 0 }}>
              <div
                className={`avatar avatar-${c.avatarTone}`}
                style={{ width: 32, height: 32 }}
              >
                {c.avatarText}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 6, minWidth: 0 }}>
                  <strong className="truncate">{c.name}</strong>
                  {c.vip && <span className="pill pill-warning">VIP</span>}
                </div>
                <div className="text-xs text-muted truncate">{c.email}</div>
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                className="truncate"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {c.company}
              </div>
              <div className="text-xs text-muted truncate">
                {isCompact
                  ? `${c.title} · ${c.groups.join(" / ") || "默认分组"}`
                  : c.title}
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <span
                className="pill pill-neutral"
                style={{ maxWidth: "100%", overflow: "hidden" }}
              >
                <span className="truncate">{c.sourceTag}</span>
              </span>
            </div>

            {!isCompact && (
              <div className="row" style={{ gap: 4, overflow: "hidden" }}>
                {c.groups.slice(0, 2).map((g) => (
                  <span key={g} className="pill pill-accent truncate">
                    {g}
                  </span>
                ))}
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {c.mailCount} 封
              </div>
              <div className="text-xs text-muted truncate">
                {c.lastContactText}
              </div>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 5 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ height: 26, padding: "0 9px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  composeStore.openNewCompose([`${c.name} <${c.email}>`]);
                }}
              >
                {isCompact ? "写信" : "写邮件"}
              </button>
              <Tooltip label="更多联系人操作">
                <button
                  type="button"
                  className="icon-btn icon-btn-bordered"
                  style={{ width: 26, height: 26 }}
                  aria-label="更多联系人操作"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuState({
                      contact: c,
                      left: rect.right - 196,
                      top: rect.bottom + 6,
                    });
                  }}
                >
                  <Icon name="more" size={13} />
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      {activeMenu && (
        <ActionMenu
          x={activeMenu.left}
          y={activeMenu.top}
          closing={closing}
          minWidth={198}
          onClose={() => setMenuState(null)}
          items={[
            {
              label: "查看往来详情",
              icon: "users",
              onSelect: () => onSelect(activeMenu.contact.id),
            },
            {
              label: activeMenu.contact.vip
                ? "取消 VIP 标记"
                : "设为 VIP 联系人",
              icon: "star",
              onSelect: () => workspace.toggleContactVip(activeMenu.contact.id),
            },
            {
              label: "编辑联系人资料…",
              icon: "edit",
              onSelect: () =>
                workspace.setOverlay({
                  type: "contact-edit",
                  contactId: activeMenu.contact.id,
                }),
            },
            { type: "divider" },
            {
              label: "加入拦截黑名单",
              icon: "ban",
              danger: true,
              onSelect: () => {
                workspace.addBlacklist({
                  target: activeMenu.contact.email,
                  kind: "address",
                  reason: `从通讯录快捷拦截（${activeMenu.contact.name}）`,
                  blockedCount: 0,
                  addedAt: "2026-11-22",
                });
                toastStore.pushToast({
                  tone: "warning",
                  title: `已拦截 ${activeMenu.contact.email}`,
                });
              },
            },
          ]}
        />
      )}
    </>
  );
}
