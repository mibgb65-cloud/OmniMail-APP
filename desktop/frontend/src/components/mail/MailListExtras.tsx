import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { LabelPickerPopover } from "./LabelPickerPopover";

export function MailListBatchBar() {
  const { t } = useI18n();
  const { workspace, mailStore, toastStore } = useApp();
  const { checkedIds } = mailStore;
  const [labelAnchor, setLabelAnchor] = useState<HTMLElement | null>(null);

  if (checkedIds.length === 0) return null;
  const pushInfo = (title: string) =>
    toastStore.pushToast({ tone: "info", title });

  return (
    <div className="batch-bar">
      <strong>
        {t("mailList.batchSelected", { count: checkedIds.length })}
      </strong>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            mailStore.markRead(checkedIds, false);
            pushInfo(t("toasts.markedReadCount", { count: checkedIds.length }));
          }}
        >
          {t("mailList.batchMarkRead")}
        </button>
        <button
          type="button"
          data-batch-label-trigger="true"
          aria-expanded={labelAnchor !== null}
          className={`btn btn-sm btn-secondary${labelAnchor ? " is-label-open" : ""}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            const el = e.currentTarget;
            setLabelAnchor((prev) => (prev ? null : el));
          }}
        >
          {t("labels.batchLabel")}
        </button>
        {labelAnchor && (
          <LabelPickerPopover
            mailIds={checkedIds}
            anchorEl={labelAnchor}
            onClose={() => setLabelAnchor(null)}
          />
        )}
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            mailStore.moveMails(checkedIds, "archive");
            pushInfo(t("toasts.batchArchived"));
          }}
        >
          {t("mailList.batchArchive")}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() =>
            workspace.setOverlay({ type: "move-folder", mailIds: checkedIds })
          }
        >
          {t("mailList.batchMove")}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger-soft"
          onClick={() => {
            mailStore.moveMails(checkedIds, "trash");
            pushInfo(t("toasts.batchMovedTrash"));
          }}
        >
          {t("mailList.batchDelete")}
        </button>
        <button
          type="button"
          className="icon-btn"
          style={{ width: 24, height: 24 }}
          onClick={mailStore.clearChecked}
          aria-label={t("mailList.batchClearAria")}
        >
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  );
}

export function MailListEmptyState({
  noAccounts = false,
}: {
  noAccounts?: boolean;
}) {
  const { t } = useI18n();
  const { workspace, mailStore } = useApp();
  if (noAccounts || workspace.accounts.length === 0) {
    return (
      <div className="list-empty-state">
        <span className="list-empty-icon-box" aria-hidden="true">
          <Icon name="mail" size={22} />
        </span>
        <div
          style={{ fontWeight: 700, fontSize: 14, color: "var(--text-ink)" }}
        >
          {t("mailList.emptyNoAccountTitle")}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.55, maxWidth: 268 }}>
          {t("mailList.emptyNoAccountDesc")}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ height: 36, padding: "0 16px" }}
          onClick={() => workspace.setOverlay({ type: "add-account" })}
        >
          <Icon name="plus" size={13} /> {t("sidebar.addFirstAccount")}
        </button>
      </div>
    );
  }

  const { searchQuery, activeAccountId, activeLabelId, filterTab } = mailStore;
  const hasFilters = Boolean(
    searchQuery || activeAccountId || activeLabelId || filterTab !== "all",
  );

  return (
    <div className="list-empty-state">
      <Icon name={searchQuery ? "search" : "inbox"} size={28} />
      <div style={{ fontWeight: 600, color: "var(--text-ink)" }}>
        {t(
          searchQuery
            ? "mailList.emptyNoMatchTitle"
            : "mailList.emptyFolderTitle",
        )}
      </div>
      <div style={{ fontSize: 12, maxWidth: 240 }}>
        {t(
          searchQuery
            ? "mailList.emptyNoMatchDesc"
            : "mailList.emptyFolderDesc",
        )}
      </div>
      {hasFilters && (
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            mailStore.setSearchQuery("");
            mailStore.setFilterTab("all");
            mailStore.resetAdvSearch();
            mailStore.selectFolder("inbox");
          }}
        >
          {t("mailList.resetFilters")}
        </button>
      )}
    </div>
  );
}

export function MailListLoadError({
  detail,
  onRetry,
}: {
  detail: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="list-empty-state" role="alert">
      <Icon name="alertCircle" size={28} />
      <div style={{ fontWeight: 600, color: "var(--text-ink)" }}>
        {t("mailList.loadListFailedTitle")}
      </div>
      {detail && <div style={{ fontSize: 12, maxWidth: 260 }}>{detail}</div>}
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        onClick={onRetry}
      >
        {t("mailList.retryLoadMoreBtn")}
      </button>
    </div>
  );
}
