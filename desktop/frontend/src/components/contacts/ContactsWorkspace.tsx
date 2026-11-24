import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { useValuePresence } from "../../state/usePresence";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { BlacklistManagerView } from "./BlacklistManagerView";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { ContactsDirectoryHeader } from "./ContactsDirectoryHeader";
import type { ContactNavFilter } from "./ContactsSidebar";
import { ContactsTableRows } from "./ContactsTableRows";

export function useContactsNavState() {
  const [navFilter, setNavFilter] = useState<ContactNavFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  return {
    navFilter,
    groupFilter,
    accountFilter,
    onSelectNav: setNavFilter,
    onSelectGroup: setGroupFilter,
    onSelectAccount: setAccountFilter,
  };
}

export type ContactsNavState = ReturnType<typeof useContactsNavState>;

export function ContactsWorkspace({
  nav,
  readOnlyExit = false,
}: {
  nav: ContactsNavState;
  readOnlyExit?: boolean;
}) {
  const { viewport, workspace } = useApp();
  const { t, localizeGroup } = useI18n();
  const { navFilter, groupFilter, accountFilter, onSelectGroup } = nav;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== "undefined" && window.innerWidth >= 1440
      ? (workspace.contacts[0]?.id ?? null)
      : null,
  );

  const isWide = viewport === "wide";
  const isCompact = viewport === "compact";

  useEffect(() => {
    if (!selectedId || readOnlyExit) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && workspace.overlay.type === "none") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, readOnlyExit, workspace.overlay.type]);

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
          !c.alternateEmails?.some((email) =>
            email.toLowerCase().includes(q),
          ) &&
          !c.company.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.mailCount - a.mailCount);
  }, [workspace.contacts, navFilter, groupFilter, accountFilter, query]);

  const selectedContact =
    selectedId !== null && navFilter !== "blacklist"
      ? (filteredContacts.find((c) => c.id === selectedId) ?? null)
      : null;

  const wideDetail = useValuePresence(isWide ? selectedContact : null, 150);
  const drawerDetail = useValuePresence(
    !isWide && !readOnlyExit ? selectedContact : null,
    180,
  );

  return (
    <>
      <section
        className="panel-card contacts-directory-card"
        aria-label={t("contacts.directoryAria")}
      >
        <ContactsDirectoryHeader
          title={
            navFilter === "blacklist"
              ? t("contacts.headingBlacklist")
              : groupFilter
                ? t("contacts.headingGroup", {
                    group: localizeGroup(groupFilter),
                  })
                : t("contacts.headingAll")
          }
          blacklist={navFilter === "blacklist"}
          compact={isCompact}
          query={query}
          groupFilter={groupFilter}
          onQuery={setQuery}
          onGroup={onSelectGroup}
        />

        {navFilter === "blacklist" ? (
          <FadeScroll
            className="modal-body"
            label={t("contacts.blacklistScrollLabel")}
          >
            <BlacklistManagerView />
          </FadeScroll>
        ) : (
          <ContactsTableRows
            contacts={filteredContacts}
            selectedId={selectedContact?.id ?? null}
            onSelect={setSelectedId}
          />
        )}

        <div className="contacts-dir-footer">
          <span className="truncate">
            {t("contacts.footerSummary", {
              shown: filteredContacts.length,
              total: workspace.contacts.length,
            })}
          </span>
        </div>
      </section>

      {wideDetail.rendered && isWide && (
        <ContactDetailPanel
          contact={wideDetail.rendered}
          closing={wideDetail.closing}
          onClose={() => setSelectedId(null)}
        />
      )}

      {drawerDetail.rendered && !isWide && (
        <ContactDetailPanel
          contact={drawerDetail.rendered}
          isDrawer
          closing={drawerDetail.closing}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
