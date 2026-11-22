import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import type { ContactItem } from "../../types/workspace";
import { Icon } from "../common/Icon";

export function ContactsTableRows({
  contacts,
  selectedId,
  onSelect,
}: {
  contacts: ContactItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { viewport, workspace, composeStore } = useApp();
  const [menuState, setMenuState] = useState<{
    contact: ContactItem;
    left: number;
    top: number;
  } | null>(null);

  const isCompact = viewport === "compact";

  useEffect(() => {
    if (!menuState) return;
    const close = () => setMenuState(null);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [menuState]);

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
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-ink)",
                }}
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
              <div
                className="row"
                style={{ gap: 4, minWidth: 0, overflow: "hidden" }}
              >
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
              <button
                type="button"
                className="icon-btn icon-btn-bordered"
                style={{ width: 26, height: 26 }}
                title="更多联系人操作"
                aria-label="更多联系人操作"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuState({
                    contact: c,
                    left: Math.max(
                      12,
                      Math.min(rect.right - 180, window.innerWidth - 196),
                    ),
                    top: Math.min(rect.bottom + 6, window.innerHeight - 180),
                  });
                }}
              >
                <Icon name="more" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {menuState && (
        <div
          className="context-menu"
          style={{ left: menuState.left, top: menuState.top, minWidth: 180 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              onSelect(menuState.contact.id);
              setMenuState(null);
            }}
          >
            <span>查看往来详情</span>
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              workspace.toggleContactVip(menuState.contact.id);
              setMenuState(null);
            }}
          >
            <span>
              {menuState.contact.vip ? "取消 VIP 标记" : "设为 VIP 联系人"}
            </span>
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              workspace.setOverlay({
                type: "contact-edit",
                contactId: menuState.contact.id,
              });
              setMenuState(null);
            }}
          >
            <span>编辑联系人资料…</span>
          </button>
        </div>
      )}
    </>
  );
}
