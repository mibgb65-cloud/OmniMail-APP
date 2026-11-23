import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { CustomSelect } from "../common/CustomSelect";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";

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
      heading="高级搜索"
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
          <CustomSelect
            fullWidth
            minMenuWidth={220}
            style={{ marginTop: 4 }}
            value={accountId}
            ariaLabel="搜索邮箱范围"
            options={[
              { value: "all", label: "全部已连接邮箱" },
              ...workspace.accounts.map((acc) => ({
                value: acc.id,
                label: acc.name,
                sublabel: acc.email,
                icon: <ProviderIcon provider={acc.provider} size={18} />,
              })),
            ]}
            onChange={setAccountId}
          />
        </div>
        <div>
          <label className="text-xs text-muted">时间范围</label>
          <CustomSelect
            fullWidth
            style={{ marginTop: 4 }}
            value={dateRange}
            ariaLabel="搜索时间范围"
            options={[
              { value: "all", label: "不限时间" },
              { value: "7d", label: "最近 7 天" },
              { value: "30d", label: "最近 30 天" },
              { value: "90d", label: "最近 90 天" },
            ]}
            onChange={(val) =>
              setDateRange(val as "all" | "7d" | "30d" | "90d")
            }
          />
        </div>
      </div>

      <Checkbox
        checked={hasAttachment}
        onChange={setHasAttachment}
        ariaLabel="仅显示包含附件的邮件"
      >
        仅显示包含附件的邮件
      </Checkbox>
    </ModalShell>
  );
}
