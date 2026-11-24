import { useState, type MouseEvent } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { useValuePresence } from "../../state/usePresence";
import type { ContactItem } from "../../types/workspace";
import { ActionMenu, type ActionMenuEntry } from "../common/ActionMenu";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";

interface Props {
  contacts: ContactItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}
export function ContactsTableRows({ contacts, selectedId, onSelect }: Props) {
  const { viewport, workspace, composeStore, toastStore } = useApp();
  const { addBlacklist, toggleContactVip, setOverlay } = workspace;
  const { isEn, t, formatTime, localizeGroup, localizeText } = useI18n();
  const [menu, setMenu] = useState<[ContactItem, number, number] | null>(null);
  const { rendered: active, closing } = useValuePresence(menu, 100);
  const compact = viewport === "compact";
  const moreTip = t("contacts.moreContactActionsTip");

  const openMoreMenu = (e: MouseEvent<HTMLButtonElement>, c: ContactItem) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu([c, r.right - 196, r.bottom + 6]);
  };
  const openContext = (e: MouseEvent<HTMLDivElement>, c: ContactItem) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu([c, e.clientX, e.clientY]);
  };

  const menuItems = (c: ContactItem): ActionMenuEntry[] => [
    {
      label: t("contacts.menuViewDetails"),
      icon: "users",
      onSelect: () => onSelect(c.id),
    },
    {
      label: t(c.vip ? "contacts.menuUnsetVip" : "contacts.menuSetVip"),
      icon: "star",
      onSelect: () => toggleContactVip(c.id),
    },
    {
      label: t("contacts.menuEditProfile"),
      icon: "edit",
      onSelect: () => setOverlay({ type: "contact-edit", contactId: c.id }),
    },
    { type: "divider" },
    {
      label: t("contacts.menuAddToBlacklist"),
      icon: "ban",
      danger: true,
      onSelect: () => {
        const target = c.email;
        const reason = t("contacts.blacklistQuickReason", { name: c.name });
        const addedAt = "2026-11-22";
        addBlacklist({
          target,
          kind: "address",
          reason,
          blockedCount: 0,
          addedAt,
        });
        const title = t("toasts.blockedEmail", { email: target });
        toastStore.pushToast({ tone: "warning", title });
      },
    },
  ];

  const renderRow = (c: ContactItem) => {
    const role = localizeText(c.title);
    const grp =
      c.groups.map(localizeGroup).join(" / ") || t("contacts.defaultGroup");
    const rawTime =
      isEn && c.lastContactText.startsWith("最近 ")
        ? c.lastContactText.slice(3)
        : c.lastContactText;
    const avatarCls = `avatar avatar-${c.avatarTone}`;
    const rowCls = `contacts-table-row${selectedId === c.id ? " selected" : ""}`;
    return (
      <div
        key={c.id}
        className={rowCls}
        onClick={() => onSelect(c.id)}
        onContextMenu={(e) => openContext(e, c)}
      >
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <div className={avatarCls} style={{ width: 32, height: 32 }}>
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
          <div className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
            {localizeText(c.company)}
          </div>
          <div className="text-xs text-muted truncate">
            {compact ? `${role} · ${grp}` : role}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <span
            className="pill pill-neutral"
            style={{ maxWidth: "100%", overflow: "hidden" }}
          >
            <span className="truncate">{localizeText(c.sourceTag)}</span>
          </span>
        </div>
        {!compact && (
          <div className="row" style={{ gap: 4, overflow: "hidden" }}>
            {c.groups.slice(0, 2).map((g) => (
              <span key={g} className="pill pill-accent truncate">
                {localizeGroup(g)}
              </span>
            ))}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {t("contacts.mailCountText", { count: c.mailCount })}
          </div>
          <div className="text-xs text-muted truncate">
            {formatTime(rawTime)}
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
            {t(
              compact ? "contacts.writeMailCompact" : "contacts.writeMailFull",
            )}
          </button>
          <Tooltip label={moreTip}>
            <button
              type="button"
              className="icon-btn icon-btn-bordered"
              style={{ width: 26, height: 26 }}
              aria-label={moreTip}
              onClick={(e) => openMoreMenu(e, c)}
            >
              <Icon name="more" size={13} />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  };

  const orgCol = compact
    ? "contacts.colOrgGroupCompact"
    : "contacts.colCompanyTitle";
  return (
    <>
      <div className="contacts-table-head">
        <span>{t("contacts.colContactEmail")}</span>
        <span>{t(orgCol)}</span>
        <span>{t("contacts.colSourceAccount")}</span>
        {!compact && <span>{t("contacts.colGroups")}</span>}
        <span>{t("contacts.colActivity")}</span>
        <span style={{ textAlign: "right" }}>{t("contacts.colActions")}</span>
      </div>
      <FadeScroll
        className="contacts-rows-scroll"
        label={t("contacts.rowsScrollLabel")}
      >
        {contacts.map(renderRow)}
      </FadeScroll>
      {active && (
        <ActionMenu
          x={active[1]}
          y={active[2]}
          closing={closing}
          minWidth={198}
          onClose={() => setMenu(null)}
          items={menuItems(active[0])}
        />
      )}
    </>
  );
}
