import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { ModalShell } from "../common/ModalShell";

export function AdvancedSearchModal() {
  const { workspace, mailStore, toastStore } = useApp();
  const [from, setFrom] = useState(mailStore.advSearch.from);
  const [subject, setSubject] = useState(mailStore.advSearch.subject);
  const [accountId, setAccountId] = useState(mailStore.advSearch.accountId);
  const [hasAttachment, setHasAttachment] = useState(
    mailStore.advSearch.hasAttachment,
  );
  const [dateRange, setDateRange] = useState(mailStore.advSearch.dateRange);

  const apply = () => {
    mailStore.setAdvSearch({
      from,
      to: mailStore.advSearch.to,
      subject,
      accountId,
      hasAttachment,
      dateRange,
    });
    workspace.setScreen("mail");
    workspace.setOverlay({ type: "none" });
    toastStore.pushToast({
      tone: "info",
      title: "已应用高级搜索过滤条件",
      detail: "可在搜索框清空或重新打开高级搜索重置条件",
    });
  };

  const reset = () => {
    mailStore.resetAdvSearch();
    setFrom("");
    setSubject("");
    setAccountId("all");
    setHasAttachment(false);
    setDateRange("all");
  };

  return (
    <ModalShell
      title="高级搜索"
      subtitle="跨多邮箱本地全文检索，组合条件实时生效"
      maxWidth={520}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={reset}>
            重置全部条件
          </button>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={apply}>
              立即搜索
            </button>
          </div>
        </>
      }
    >
      <div>
        <label className="text-xs text-muted">发件人姓名或邮箱</label>
        <input
          className="input"
          style={{ marginTop: 4 }}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="例如 林知夏 或 studio.example"
        />
      </div>

      <div>
        <label className="text-xs text-muted">主题关键词</label>
        <input
          className="input"
          style={{ marginTop: 4 }}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="例如 OmniMail、评审、发票"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">邮箱范围</label>
          <select
            className="select"
            style={{ marginTop: 4, width: "100%" }}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="all">全部已连接邮箱</option>
            {workspace.accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">时间范围</label>
          <select
            className="select"
            style={{ marginTop: 4, width: "100%" }}
            value={dateRange}
            onChange={(e) =>
              setDateRange(e.target.value as "all" | "7d" | "30d" | "90d")
            }
          >
            <option value="all">不限时间</option>
            <option value="7d">最近 7 天</option>
            <option value="30d">最近 30 天</option>
            <option value="90d">最近 90 天</option>
          </select>
        </div>
      </div>

      <label className="row" style={{ fontSize: 13, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={hasAttachment}
          onChange={(e) => setHasAttachment(e.target.checked)}
        />
        <span>仅显示包含附件的邮件</span>
      </label>
    </ModalShell>
  );
}
