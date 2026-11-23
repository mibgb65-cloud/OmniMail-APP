import { useState } from "react";
import { mailApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { DateTimePicker } from "../common/DateTimePicker";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

const SNOOZE_PRESETS: Array<[string, string, number]> = [
  ["今天晚些时候", "3 小时后", 3 * 3600 * 1000],
  ["明天上午", "明天 09:00", 18 * 3600 * 1000],
  ["本周末", "2 天后", 48 * 3600 * 1000],
  ["下周一上午", "4 天后", 96 * 3600 * 1000],
];

export function SnoozeModal({ mailIds }: { mailIds: string[] }) {
  const { workspace, mailStore, toastStore } = useApp();
  const [customTime, setCustomTime] = useState("2026-11-24 09:00");

  const apply = async (label: string, wakeMs: number) => {
    try {
      await mailApi.snoozeMessages(mailIds, wakeMs);
      mailStore.moveMails(mailIds, "snoozed", {
        snoozeUntil: label,
        statusBadge: `提醒：${label}`,
      });
      workspace.setOverlay({ type: "none" });
      toastStore.pushToast({
        tone: "success",
        title: `已将 ${mailIds.length} 封邮件延后至「${label}」`,
        detail: "到期后后端唤醒器将自动移回统一收件箱",
      });
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: "设置稍后处理失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading="设置稍后处理提醒"
      subtitle={`已选 ${mailIds.length} 封邮件 · 到期后自动回到统一收件箱`}
      maxWidth={440}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">提醒不会删除原邮件</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const parsed = Date.parse(customTime.replace(" ", "T"));
              const ms = Number.isFinite(parsed)
                ? parsed
                : Date.now() + 12 * 3600 * 1000;
              void apply(customTime, ms);
            }}
          >
            应用自定义时间
          </button>
        </>
      }
    >
      {SNOOZE_PRESETS.map(([label, val, deltaMs]) => (
        <button
          key={label}
          type="button"
          className="provider-card"
          onClick={() => void apply(val, Date.now() + deltaMs)}
        >
          <span className="row">
            <Icon name="clock" size={15} />
            <strong>{label}</strong>
          </span>
          <span className="text-xs text-muted">{val}</span>
        </button>
      ))}
      <div>
        <label className="text-xs text-muted">自定义提醒日期与时间</label>
        <DateTimePicker
          style={{ marginTop: 4 }}
          value={customTime}
          onChange={setCustomTime}
          ariaLabel="选择稍后提醒日期与时间"
        />
      </div>
    </ModalShell>
  );
}
