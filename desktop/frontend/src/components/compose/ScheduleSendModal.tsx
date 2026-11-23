import { useMemo, useState } from "react";
import { useApp } from "../../state/AppContext";
import { DateTimePicker } from "../common/DateTimePicker";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

function formatLocalMinute(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildSchedulePresets() {
  const now = new Date();
  const tmrMorning = new Date(now);
  tmrMorning.setDate(now.getDate() + 1);
  tmrMorning.setHours(9, 0, 0, 0);

  const tmrAfternoon = new Date(now);
  tmrAfternoon.setDate(now.getDate() + 1);
  tmrAfternoon.setHours(14, 0, 0, 0);

  const nextMon = new Date(now);
  const daysUntilMon = (8 - now.getDay()) % 7 || 7;
  nextMon.setDate(now.getDate() + daysUntilMon);
  nextMon.setHours(9, 0, 0, 0);

  const weekNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return [
    {
      label: "明天上午",
      value: formatLocalMinute(tmrMorning),
      hint: `${weekNames[tmrMorning.getDay()]} 09:00`,
    },
    {
      label: "明天下午",
      value: formatLocalMinute(tmrAfternoon),
      hint: `${weekNames[tmrAfternoon.getDay()]} 14:00`,
    },
    {
      label: "下周一上午",
      value: formatLocalMinute(nextMon),
      hint: "周一 09:00",
    },
  ];
}

export function ScheduleSendModal() {
  const { workspace, composeStore, toastStore } = useApp();
  const presets = useMemo(() => buildSchedulePresets(), []);
  const [customTime, setCustomTime] = useState(presets[0].value);

  const applyTime = (timeText: string) => {
    const parsedMs = new Date(timeText.replace(" ", "T")).getTime();
    if (!Number.isFinite(parsedMs) || parsedMs <= Date.now()) {
      toastStore.pushToast({
        tone: "warning",
        title: "请选择未来的发送时间",
      });
      return;
    }
    composeStore.updateDraft({
      scheduledAt: timeText,
      scheduledAtUnixMs: parsedMs,
    });
    workspace.setOverlay({ type: "none" });
    toastStore.pushToast({
      tone: "info",
      title: `已设定定时发送：${timeText}`,
      detail: "点击写信窗口底部「确认定时发送」即可加入持久化定时队列",
    });
  };

  return (
    <ModalShell
      heading="选择定时发送时间"
      subtitle="到达计划时间后将由本地持久化队列按锁定发件账户发出"
      maxWidth={460}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">关闭应用重启后仍可自动补发</span>
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
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className="provider-card"
            onClick={() => applyTime(p.value)}
          >
            <span className="row">
              <Icon name="clock" size={15} />
              <strong>{p.label}</strong>
            </span>
            <span className="text-xs text-muted">
              {p.value}（{p.hint}）
            </span>
          </button>
        ))}
      </div>

      <div className="settings-card">
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          自定义日期与发送时间
        </label>
        <DateTimePicker
          value={customTime}
          onChange={setCustomTime}
          ariaLabel="选择定时发送日期与时间"
        />
      </div>
    </ModalShell>
  );
}
