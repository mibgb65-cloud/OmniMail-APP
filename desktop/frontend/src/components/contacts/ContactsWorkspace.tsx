import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../state/AppContext";
import { BlacklistManagerView } from "./BlacklistManagerView";
import { ContactDetailPanel } from "./ContactDetailPanel";
import {
  CONTACT_GROUPS,
  ContactsSidebar,
  type ContactNavFilter,
} from "./ContactsSidebar";
import { ContactsTableRows } from "./ContactsTableRows";

export function ContactsWorkspace() {
  const { viewport, workspace } = useApp();
  const [navFilter, setNavFilter] = useState<ContactNavFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== "undefined" && window.innerWidth >= 1440
      ? (workspace.contacts[0]?.id ?? null)
      : null,
  );

  const isWide = viewport === "wide";
  const isCompact = viewport === "compact";

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && workspace.overlay.type === "none") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, workspace.overlay.type]);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workspace.contacts
      .filter((c) => {
        if (navFilter === "vip" && !c.vip) return false;
        if (navFilter === "frequent" && c.mailCount < 20) return false;
        if (groupFilter && !c.groups.includes(groupFilter)) return false;
        if (accountFilter && c.sourceAccountId !== accountFilter) return false;
        if (
          q &&
          !c.name.toLowerCase().includes(q) &&
          !c.email.toLowerCase().includes(q) &&
          !c.company.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.mailCount - a.mailCount);
  }, [workspace.contacts, navFilter, groupFilter, accountFilter, query]);

  const selectedContact =
    selectedId !== null
      ? (filteredContacts.find((c) => c.id === selectedId) ?? null)
      : null;

  return (
    <div className="workspace-grid">
      <ContactsSidebar
        navFilter={navFilter}
        groupFilter={groupFilter}
        accountFilter={accountFilter}
        onSelectNav={setNavFilter}
        onSelectGroup={setGroupFilter}
        onSelectAccount={setAccountFilter}
      />

      <section
        className="panel-card contacts-directory-card"
        aria-label="联系人目录"
      >
        <div className="contacts-dir-header">
          <div className="row-between" style={{ gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="modal-title truncate" style={{ fontSize: 17 }}>
                {navFilter === "blacklist"
                  ? "黑名单与发件人拦截"
                  : groupFilter
                    ? `分组：${groupFilter}`
                    : "联系人与通讯录"}
              </h1>
              <div className="modal-sub truncate">
                本地汇总多邮箱往来记录 · VIP 邮件在统一收件箱优先高亮提醒
              </div>
            </div>
            {navFilter !== "blacklist" && (
              <input
                type="search"
                className="input"
                style={{
                  width: isCompact ? 188 : 228,
                  height: 32,
                  flexShrink: 0,
                }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索姓名、邮箱或公司…"
              />
            )}
          </div>

          {isCompact && navFilter !== "blacklist" && (
            <div className="row" style={{ gap: 6, overflow: "hidden" }}>
              <button
                type="button"
                className={`btn btn-sm ${!groupFilter ? "btn-primary" : "btn-secondary"}`}
                style={{ height: 26, padding: "0 9px" }}
                onClick={() => setGroupFilter(null)}
              >
                全部分组
              </button>
              {CONTACT_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`btn btn-sm ${groupFilter === g ? "btn-primary" : "btn-secondary"}`}
                  style={{ height: 26, padding: "0 9px" }}
                  onClick={() => setGroupFilter(groupFilter === g ? null : g)}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {navFilter === "blacklist" ? (
          <div className="modal-body">
            <BlacklistManagerView />
          </div>
        ) : (
          <ContactsTableRows
            contacts={filteredContacts}
            selectedId={selectedContact?.id ?? null}
            onSelect={(id) => setSelectedId(id)}
          />
        )}

        <div className="contacts-dir-footer">
          <span className="truncate">
            显示第 1–{filteredContacts.length} 位，共{" "}
            {workspace.contacts.length} 位联系人 · 仅保存在本地加密通讯录数据库
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ height: 26, flexShrink: 0 }}
            onClick={() => workspace.setOverlay({ type: "contact-edit" })}
          >
            + 新建联系人
          </button>
        </div>
      </section>

      {navFilter !== "blacklist" && selectedContact && isWide && (
        <ContactDetailPanel
          contact={selectedContact}
          onClose={() => setSelectedId(null)}
        />
      )}

      {navFilter !== "blacklist" && selectedContact && !isWide && (
        <ContactDetailPanel
          contact={selectedContact}
          isDrawer
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
