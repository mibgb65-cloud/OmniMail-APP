import { useApp } from "../../state/AppContext";
import type { FolderId } from "../../types/mail";
import { Icon, type IconName } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

const TARGET_FOLDERS: Array<{ id: FolderId; label: string; icon: IconName }> = [
  { id: "inbox", label: "统一收件箱", icon: "inbox" },
  { id: "archive", label: "归档邮件", icon: "archive" },
  { id: "spam", label: "垃圾邮件", icon: "spam" },
  { id: "trash", label: "回收站", icon: "trash" },
];

export function MoveFolderModal({ mailIds }: { mailIds: string[] }) {
  const { workspace, mailStore, toastStore } = useApp();

  return (
    <ModalShell
      heading="移动邮件至文件夹"
      subtitle={`将已选 ${mailIds.length} 封邮件移动至目标文件夹`}
      maxWidth={420}
      onClose={() => workspace.setOverlay({ type: "none" })}
    >
      {TARGET_FOLDERS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="provider-card"
          onClick={() => {
            mailStore.moveMails(mailIds, t.id);
            workspace.setOverlay({ type: "none" });
            toastStore.pushToast({
              tone: "success",
              title: `已将 ${mailIds.length} 封邮件移至「${t.label}」`,
            });
          }}
        >
          <span className="row">
            <Icon name={t.icon} size={15} />
            <strong>{t.label}</strong>
          </span>
          <Icon name="chevronRight" size={14} />
        </button>
      ))}
    </ModalShell>
  );
}
