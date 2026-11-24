import { useI18n, type TranslationKey } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { FolderId } from "../../types/mail";
import { Icon, type IconName } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

const TARGET_FOLDERS: Array<{
  id: FolderId;
  labelKey: TranslationKey;
  icon: IconName;
}> = [
  { id: "inbox", labelKey: "sidebar.unifiedInbox", icon: "inbox" },
  { id: "archive", labelKey: "sidebar.archive", icon: "archive" },
  { id: "spam", labelKey: "sidebar.spam", icon: "spam" },
  { id: "trash", labelKey: "sidebar.trash", icon: "trash" },
];

export function MoveFolderModal({ mailIds }: { mailIds: string[] }) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t } = useI18n();

  return (
    <ModalShell
      heading={t("overlays.moveHeading")}
      subtitle={t("overlays.moveSubtitle", { count: mailIds.length })}
      maxWidth={420}
      onClose={() => workspace.setOverlay({ type: "none" })}
    >
      {TARGET_FOLDERS.map((item) => {
        const label = t(item.labelKey);
        return (
          <button
            key={item.id}
            type="button"
            className="provider-card"
            onClick={() => {
              mailStore.moveMails(mailIds, item.id);
              workspace.setOverlay({ type: "none" });
              toastStore.pushToast({
                tone: "success",
                title: t("toasts.movedMailsToFolder", {
                  count: mailIds.length,
                  folder: label,
                }),
              });
            }}
          >
            <span className="row">
              <Icon name={item.icon} size={15} />
              <strong>{label}</strong>
            </span>
            <Icon name="chevronRight" size={14} />
          </button>
        );
      })}
    </ModalShell>
  );
}
