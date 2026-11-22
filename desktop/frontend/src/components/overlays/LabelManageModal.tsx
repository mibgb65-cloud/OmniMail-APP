import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { ModalShell } from "../common/ModalShell";

export function LabelManageModal({ mailIds }: { mailIds?: string[] }) {
  const { workspace, mailStore, toastStore } = useApp();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#2563EB");
  const targetMail =
    mailIds?.length === 1
      ? mailStore.mails.find((m) => m.id === mailIds[0])
      : null;

  const createLabel = () => {
    const clean = newName.trim();
    if (!clean) return;
    mailStore.createLabel(clean, newColor);
    setNewName("");
    toastStore.pushToast({ tone: "success", title: `已创建标签「${clean}」` });
  };

  return (
    <ModalShell
      title="管理邮件标签"
      subtitle={
        mailIds && mailIds.length > 0
          ? `为已选 ${mailIds.length} 封邮件勾选或新建标签`
          : "新建或维护工作空间自定义标签"
      }
      maxWidth={460}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">标签在统一收件箱跨邮箱共享</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            完成
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {mailStore.labels.map((lb) => {
          const checked = targetMail
            ? targetMail.labels.includes(lb.id)
            : false;
          return (
            <div
              key={lb.id}
              className="provider-card"
              style={{ padding: "9px 12px" }}
            >
              <label className="row" style={{ flex: 1, cursor: "pointer" }}>
                {mailIds && mailIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => mailStore.toggleMailLabel(mailIds, lb.id)}
                  />
                )}
                <span className="label-dot" style={{ background: lb.color }} />
                <strong style={{ fontSize: 13 }}>{lb.name}</strong>
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--status-danger)" }}
                onClick={() =>
                  workspace.setOverlay({
                    type: "danger-confirm",
                    kind: "delete-label",
                    targetId: lb.id,
                    targetLabel: lb.name,
                  })
                }
              >
                删除
              </button>
            </div>
          );
        })}
      </div>

      <div className="settings-card">
        <div className="text-xs text-muted">新建自定义标签</div>
        <div className="row">
          <input
            className="input"
            style={{ flex: 1 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例如 客户跟进、发版审核"
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={{
              width: 34,
              height: 34,
              border: "none",
              background: "transparent",
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={createLabel}
          >
            添加
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
