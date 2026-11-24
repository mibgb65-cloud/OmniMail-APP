import { useI18n } from "../../i18n";
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
  const { t } = useI18n();

  const handleImportVCard = () => {
    void contactApi
      .importVCard()
      .then(async (res) => {
        if (!res.filePath && res.imported === 0 && res.updated === 0) return;
        const fresh = await contactApi.listContacts();
        workspace.setContacts(fresh);
        toastStore.pushToast({
          tone: "success",
          title: t("toasts.vcardImported", {
            imported: res.imported,
            updated: res.updated,
          }),
        });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: t("toasts.importVCardFailed"),
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
            title: t("toasts.exportedVCard"),
            detail: savedPath,
          });
        }
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: t("toasts.exportVCardFailed"),
          detail: parseBackendError(err).message,
        }),
      );
  };

  const importLabel = t("contacts.importVCard");
  const exportLabel = t("contacts.exportBtn");
  const reviewLabel = t("contacts.reviewDuplicates");

  return (
    <div className="contacts-toolbar-actions">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label={importLabel}
        title={importLabel}
        onClick={handleImportVCard}
      >
        <Icon name="upload" size={14} /> <span>{importLabel}</span>
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label={exportLabel}
        title={exportLabel}
        onClick={handleExportVCard}
      >
        <Icon name="download" size={14} /> <span>{exportLabel}</span>
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm contacts-review-trigger"
        data-has-duplicates={groupCount > 0}
        aria-label={
          groupCount
            ? t("contacts.reviewDuplicatesCountAria", { count: groupCount })
            : reviewLabel
        }
        title={reviewLabel}
        onClick={onReview}
      >
        <Icon name="users" size={14} /> <span>{reviewLabel}</span>
        {groupCount > 0 && (
          <strong className="contacts-dup-count">{groupCount}</strong>
        )}
      </button>
    </div>
  );
}
