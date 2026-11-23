import { contactApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function ContactsToolbarActions({
  groupCount,
  onReview,
}: {
  groupCount: number;
  onReview: () => void;
}) {
  const { workspace, toastStore } = useApp();

  const handleImportVCard = () => {
    void contactApi
      .importVCard()
      .then(async (res) => {
        if (!res.filePath && res.imported === 0 && res.updated === 0) return;
        const fresh = await contactApi.listContacts();
        workspace.setContacts(fresh);
        toastStore.pushToast({
          tone: "success",
          title: `vCard 导入完成：新增 ${res.imported} 人，补全 ${res.updated} 人`,
        });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: "导入 vCard 失败",
          detail: parseBackendError(err).message,
        }),
      );
  };

  const handleExportVCard = () => {
    void contactApi
      .exportVCard([])
      .then((savedPath) => {
        if (savedPath) {
          toastStore.pushToast({
            tone: "success",
            title: "已导出 vCard 通讯录文件",
            detail: savedPath,
          });
        }
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: "导出 vCard 失败",
          detail: parseBackendError(err).message,
        }),
      );
  };

  return (
    <div className="contacts-toolbar-actions">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label="导入 vCard"
        title="导入 vCard"
        onClick={handleImportVCard}
      >
        <Icon name="upload" size={14} /> <span>导入 vCard</span>
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label="导出"
        title="导出"
        onClick={handleExportVCard}
      >
        <Icon name="download" size={14} /> <span>导出</span>
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm contacts-review-trigger"
        data-has-duplicates={groupCount > 0}
        aria-label={
          groupCount ? `整理重复项（${groupCount} 组）` : "整理重复项"
        }
        title="整理重复项"
        onClick={onReview}
      >
        <Icon name="users" size={14} /> <span>整理重复项</span>
        {groupCount > 0 && (
          <strong className="contacts-dup-count">{groupCount}</strong>
        )}
      </button>
    </div>
  );
}
