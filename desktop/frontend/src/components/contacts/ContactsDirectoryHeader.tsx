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
  const center = useDuplicateCenter();
  return (
    <div className="contacts-dir-header">
      <div>
        <h1 className="modal-title truncate">{title}</h1>
        <div className="modal-sub truncate">
          本地汇总多邮箱往来记录 · VIP 邮件在统一收件箱优先高亮提醒
        </div>
      </div>
      {!blacklist && (
        <>
          <div
            className="contacts-directory-toolbar"
            role="toolbar"
            aria-label="通讯录操作"
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
                aria-label="搜索联系人"
                placeholder="搜索姓名、邮箱或公司…"
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                title="新建联系人"
                aria-label="新建联系人"
                onClick={() => workspace.setOverlay({ type: "contact-edit" })}
              >
                <Icon name="plus" size={14} />
                <span>新建联系人</span>
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
                  {group ?? "全部分组"}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
