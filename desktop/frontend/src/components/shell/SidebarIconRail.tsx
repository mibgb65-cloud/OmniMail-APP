import { t as defaultT, useI18n, type TranslationKey } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { FolderId, MailItem } from "../../types/mail";
import { Icon, type IconName } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export interface MainFolderItem {
  id: FolderId;
  label: string;
  icon: IconName;
  shortcut?: string;
}

const FOLDER_DEFS: readonly [FolderId, TranslationKey, IconName, string][] = [
  ["inbox", "sidebar.unifiedInbox", "inbox", "G I"],
  ["starred", "sidebar.starred", "star", "G S"],
  ["snoozed", "sidebar.snoozed", "clock", "G L"],
  ["sent", "sidebar.sent", "send", "G T"],
  ["drafts", "sidebar.drafts", "documentText", "G D"],
  ["archive", "sidebar.archive", "archive", "G A"],
];

export function getMainFolders(
  translate: (key: TranslationKey) => string = defaultT,
): MainFolderItem[] {
  return FOLDER_DEFS.map(([id, key, icon, shortcut]) => ({
    id,
    label: translate(key),
    icon,
    shortcut,
  }));
}

export const MAIN_FOLDERS = getMainFolders();
export const mainFolders = MAIN_FOLDERS;

export function countForFolder(
  mails: MailItem[],
  folder: FolderId,
  folderCounts?: Record<string, number>,
): number {
  if (isWailsDesktop() && folderCounts) {
    return folderCounts[folder] ?? 0;
  }
  if (folder === "inbox") {
    return mails.filter((m) => m.folder === "inbox" && m.unread).length;
  }
  if (folder === "starred") {
    return mails.filter((m) => m.starred && m.folder !== "trash").length;
  }
  if (
    folder === "snoozed" ||
    folder === "drafts" ||
    folder === "outbox" ||
    folder === "scheduled"
  ) {
    return mails.filter((m) => m.folder === folder).length;
  }
  return 0;
}

export function SidebarIconRail() {
  const { workspace, mailStore, composeStore, aiStore } = useApp();
  const { t, localizeText } = useI18n();
  const { mails, folderCounts, activeFolder, activeLabelId, searchQuery } =
    mailStore;
  const folders = getMainFolders(t);

  const openLeftDrawer = () => {
    aiStore.setAiOpen(false);
    workspace.setLeftNavOpen(true);
  };

  return (
    <aside
      className="panel-card icon-rail-pane"
      aria-label={t("sidebar.iconRailAria")}
    >
      <div className="icon-rail-stack">
        <Tooltip label={t("sidebar.openDrawerTip")} placement="right">
          <button
            type="button"
            className="icon-rail-btn icon-rail-trigger"
            onClick={openLeftDrawer}
            aria-label={t("sidebar.openDrawerTip")}
          >
            <Icon name="menu" size={15} />
          </button>
        </Tooltip>

        <Tooltip
          label={t("sidebar.composeNewTip")}
          shortcut="C"
          placement="right"
        >
          <button
            type="button"
            className="icon-rail-compose"
            onClick={() => composeStore.openNewCompose()}
            aria-label={t("sidebar.compose")}
          >
            <Icon name="pen" size={15} />
          </button>
        </Tooltip>

        <div className="icon-rail-divider" />

        {folders.map((item) => {
          const isActive =
            !activeLabelId && !searchQuery && activeFolder === item.id;
          const count = countForFolder(mails, item.id, folderCounts);
          return (
            <Tooltip
              key={item.id}
              label={item.label}
              badge={count}
              shortcut={item.shortcut}
              placement="right"
            >
              <button
                type="button"
                className={`icon-rail-btn ${isActive ? "active" : ""}`}
                onClick={() => mailStore.selectFolder(item.id)}
                aria-label={item.label}
              >
                <Icon name={item.icon} size={15} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className="icon-rail-stack">
        {workspace.accounts.length === 0 ? (
          <Tooltip label={t("topbar.addFirstAccountTip")} placement="right">
            <button
              type="button"
              className="icon-rail-accounts-badge is-empty"
              onClick={() => workspace.setOverlay({ type: "add-account" })}
              aria-label={t("topbar.addFirstAccountTip")}
            >
              <Icon name="plus" size={10} /> {t("sidebar.railAddAccount")}
            </button>
          </Tooltip>
        ) : (
          <Tooltip
            label={t("sidebar.railSwitchAccountsTip")}
            badge={workspace.accounts.length}
            placement="right"
          >
            <button
              type="button"
              className="icon-rail-accounts-badge"
              onClick={openLeftDrawer}
              aria-label={t("sidebar.railSwitchAccountsTip")}
            >
              {t("sidebar.railAccountsCount", {
                count: workspace.accounts.length,
              })}
            </button>
          </Tooltip>
        )}
        <Tooltip
          label={t("sidebar.railSwitchProfileTip", {
            name: localizeText(
              workspace.activeProfile?.name || t("common.personalWorkspace"),
            ),
          })}
          placement="right"
        >
          <button
            type="button"
            className="profile-avatar icon-rail-avatar"
            onClick={() =>
              workspace.setOverlay({ type: "profile-manage", mode: "switch" })
            }
            aria-label={t("sidebar.switchProfileAria")}
          >
            {localizeText(
              workspace.activeProfile?.badge || t("common.personalBadge"),
            )}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
