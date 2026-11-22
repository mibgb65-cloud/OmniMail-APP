import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

const PRESETS = [
  { label: "明天上午", value: "2026-11-21 09:00", hint: "周六 09:00" },
  { label: "明天下午", value: "2026-11-21 14:00", hint: "周六 14:00" },
  { label: "下周一上午", value: "2026-11-23 09:00", hint: "周一 09:00" },
];

export function ScheduleSendModal() {
  const { workspace, composeStore, toastStore } = useApp();
  const [customTime, setCustomTime] = useState("2026-11-21 09:00");

  const applyTime = (timeText: string) => {
    composeStore.updateDraft({ scheduledAt: timeText });
    workspace.setOverlay({ type: "none" });
    toastStore.pushToast({
      tone: "info",
      title: `已设定定时发送：${timeText}`,
      detail: "点击写信窗口底部「确认定时发送」即可加入定时队列",
    });
  };

  return (
    <ModalShell
      title="选择定时发送时间"
      subtitle="到达计划时间后将由本地或服务端队列按锁定发件账户发出"
      maxWidth={460}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">时区：中国标准时间 (UTC+8)</span>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => applyTime(customTime)}
            >
              确认时间
            </button>
          </div>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className="provider-card"
            onClick={() => applyTime(p.value)}
          >
            <span className="row">
              <Icon name="clock" size={15} />
              <strong>{p.label}</strong>
            </span>
            <span className="text-xs text-muted">{p.hint}</span>
          </button>
        ))}
      </div>

      <div className="settings-card">
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          自定义日期与时间
        </label>
        <input
          type="text"
          className="input"
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
          placeholder="例如 2026-11-24 10:30"
        />
      </div>
    </ModalShell>
  );
}
