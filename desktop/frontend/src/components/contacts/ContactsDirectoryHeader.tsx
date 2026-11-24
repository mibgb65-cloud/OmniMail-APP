import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { CONTACT_GROUPS } from "./ContactsSidebar";
import { ContactsToolbarActions } from "./ContactsToolbarActions";
import { useDuplicateCenter } from "./duplicates/DuplicateCenter";
import { DuplicateNotice } from "./duplicates/DuplicateNotice";

export function ContactsDirectoryHeader({
  title,
  blacklist,
  compact,
  query,
  groupFilter,
  onQuery,
  onGroup,
}: {
  title: string;
  blacklist: boolean;
  compact: boolean;
  query: string;
  groupFilter: string | null;
  onQuery: (value: string) => void;
  onGroup: (value: string | null) => void;
}) {
  const { workspace } = useApp();
  const { t, localizeGroup } = useI18n();
  const center = useDuplicateCenter();
  return (
    <div className="contacts-dir-header">
      <div>
        <h1 className="modal-title truncate">{title}</h1>
        <div className="modal-sub truncate">{t("contacts.directorySub")}</div>
      </div>
      {!blacklist && (
        <>
          <div
            className="contacts-directory-toolbar"
            role="toolbar"
            aria-label={t("contacts.toolbarAria")}
          >
            <ContactsToolbarActions
              groupCount={center.groups.length}
              onReview={() =>
                workspace.setOverlay({
                  type: "contact-duplicates",
                  mode: "review",
                })
              }
            />
            <div className="contacts-toolbar-end">
              <input
                type="search"
                className="input"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                aria-label={t("contacts.searchAria")}
                placeholder={t("contacts.searchPlaceholder")}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                title={t("contacts.newContact")}
                aria-label={t("contacts.newContact")}
                onClick={() => workspace.setOverlay({ type: "contact-edit" })}
              >
                <Icon name="plus" size={14} />
                <span>{t("contacts.newContact")}</span>
              </button>
            </div>
          </div>
          <DuplicateNotice />
          {compact && (
            <div className="contacts-compact-groups">
              {[null, ...CONTACT_GROUPS].map((group) => (
                <button
                  type="button"
                  key={group ?? "all"}
                  className={`btn btn-sm ${groupFilter === group ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => onGroup(groupFilter === group ? null : group)}
                >
                  {group ? localizeGroup(group) : t("contacts.allGroups")}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
