import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

const SNOOZE_PRESETS: Array<[string, string]> = [
  ["今天晚些时候", "今天 18:00"],
  ["明天上午", "明天 09:00"],
  ["本周末", "周六 10:00"],
  ["下周一上午", "下周一 09:00"],
];

export function SnoozeModal({ mailIds }: { mailIds: string[] }) {
  const { workspace, mailStore, toastStore } = useApp();
  const [customTime, setCustomTime] = useState("2026-11-23 09:00");

  const apply = (until: string) => {
    mailStore.moveMails(mailIds, "snoozed", {
      snoozeUntil: until,
      statusBadge: `提醒：${until}`,
    });
    workspace.setOverlay({ type: "none" });
    toastStore.pushToast({
      tone: "success",
      title: `已将 ${mailIds.length} 封邮件延后至「${until}」`,
      detail: "到期将自动重新置顶提醒，随时可在「稍后处理」查看",
    });
  };

  return (
    <ModalShell
      title="设置稍后处理提醒"
      subtitle={`已选 ${mailIds.length} 封邮件 · 到期后自动回到统一收件箱顶部`}
      maxWidth={440}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">提醒不会删除原邮件</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => apply(customTime)}
          >
            应用自定义时间
          </button>
        </>
      }
    >
      {SNOOZE_PRESETS.map(([label, val]) => (
        <button
          key={val}
          type="button"
          className="provider-card"
          onClick={() => apply(val)}
        >
          <span className="row">
            <Icon name="clock" size={15} />
            <strong>{label}</strong>
          </span>
          <span className="text-xs text-muted">{val}</span>
        </button>
      ))}
      <div>
        <label className="text-xs text-muted">自定义日期时间</label>
        <input
          className="input"
          style={{ marginTop: 4 }}
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
        />
      </div>
    </ModalShell>
  );
}
