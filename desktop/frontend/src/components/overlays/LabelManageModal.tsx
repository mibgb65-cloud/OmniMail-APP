import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { ModalShell } from "../common/ModalShell";

const PRESET_SWATCHES = [
  "#2563EB",
  "#4F46E5",
  "#16A34A",
  "#D97706",
  "#DC2626",
  "#0891B2",
];

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
      heading="管理邮件标签"
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
              {mailIds && mailIds.length > 0 ? (
                <Checkbox
                  checked={checked}
                  onChange={() => mailStore.toggleMailLabel(mailIds, lb.id)}
                  style={{ flex: 1 }}
                  ariaLabel={`切换标签 ${lb.name}`}
                >
                  <span className="row" style={{ gap: 8 }}>
                    <span
                      className="label-dot"
                      style={{ background: lb.color }}
                    />
                    <strong style={{ fontSize: 13 }}>{lb.name}</strong>
                  </span>
                </Checkbox>
              ) : (
                <div className="row" style={{ flex: 1, gap: 8 }}>
                  <span
                    className="label-dot"
                    style={{ background: lb.color }}
                  />
                  <strong style={{ fontSize: 13 }}>{lb.name}</strong>
                </div>
              )}
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
        <div className="row-between">
          <span className="text-xs text-muted">新建自定义标签</span>
          <div className="swatch-row" role="radiogroup" aria-label="标签颜色">
            {PRESET_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={newColor === hex}
                aria-label={`颜色 ${hex}`}
                className={`swatch-btn${newColor === hex ? " active" : ""}`}
                style={{ background: hex }}
                onClick={() => setNewColor(hex)}
              />
            ))}
          </div>
        </div>
        <div className="row">
          <input
            className="input"
            style={{ flex: 1 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createLabel();
            }}
            placeholder="例如 客户跟进、发版审核"
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
