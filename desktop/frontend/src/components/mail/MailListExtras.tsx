import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function MailListBatchBar() {
  const { workspace, mailStore, toastStore } = useApp();
  const { checkedIds } = mailStore;

  if (checkedIds.length === 0) return null;

  return (
    <div className="batch-bar">
      <strong>已选 {checkedIds.length} 封</strong>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            mailStore.markRead(checkedIds, false);
            toastStore.pushToast({
              tone: "info",
              title: `已将 ${checkedIds.length} 封邮件标为已读`,
            });
          }}
        >
          已读
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            mailStore.moveMails(checkedIds, "archive");
            toastStore.pushToast({ tone: "info", title: "已批量归档所选邮件" });
          }}
        >
          归档
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() =>
            workspace.setOverlay({ type: "move-folder", mailIds: checkedIds })
          }
        >
          移动
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger-soft"
          onClick={() => {
            mailStore.moveMails(checkedIds, "trash");
            toastStore.pushToast({ tone: "info", title: "已批量移入回收站" });
          }}
        >
          删除
        </button>
        <button
          type="button"
          className="icon-btn"
          style={{ width: 24, height: 24 }}
          onClick={mailStore.clearChecked}
          aria-label="取消多选"
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
          尚未接入任何邮箱
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.55, maxWidth: 268 }}>
          连接邮箱后，所有收件箱将在此统一汇总，并支持离线缓存与本地秒搜。
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{
            height: 36,
            padding: "0 16px",
            fontSize: 12,
            fontWeight: 600,
          }}
          onClick={() => workspace.setOverlay({ type: "add-account" })}
        >
          <Icon name="plus" size={13} /> 添加第一个邮箱
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
        {searchQuery ? "未找到匹配的邮件" : "当前列表为空"}
      </div>
      <div style={{ fontSize: 12, maxWidth: 240 }}>
        {searchQuery
          ? "尝试更换关键词，或打开高级搜索按发件人、账户与附件范围重新筛选。"
          : "所有新邮件均已处理完毕，保持清爽的工作空间。"}
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
          重置筛选条件
        </button>
      )}
    </div>
  );
}
