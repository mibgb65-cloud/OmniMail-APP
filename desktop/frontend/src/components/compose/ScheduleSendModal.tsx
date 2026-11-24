import { useMemo, useState } from "react";
import { useI18n, type TranslationKey } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { DateTimePicker } from "../common/DateTimePicker";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

function formatLocalMinute(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildSchedulePresets(t: (key: TranslationKey) => string) {
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

  const weekNames = t("compose.weekdaysSunFirst").split(",");
  return [
    {
      id: "tmr-am",
      label: t("compose.presetTomorrowMorning"),
      value: formatLocalMinute(tmrMorning),
      hint: `${weekNames[tmrMorning.getDay()] ?? ""} 09:00`,
    },
    {
      id: "tmr-pm",
      label: t("compose.presetTomorrowAfternoon"),
      value: formatLocalMinute(tmrAfternoon),
      hint: `${weekNames[tmrAfternoon.getDay()] ?? ""} 14:00`,
    },
    {
      id: "mon-am",
      label: t("compose.presetNextMonMorning"),
      value: formatLocalMinute(nextMon),
      hint: `${weekNames[1] ?? ""} 09:00`,
    },
  ];
}

export function ScheduleSendModal() {
  const { workspace, composeStore, toastStore } = useApp();
  const { isEn, t, formatTime } = useI18n();
  const presets = useMemo(() => buildSchedulePresets(t), [t]);
  const [customTime, setCustomTime] = useState(presets[0].value);

  const applyTime = (timeText: string) => {
    const parsedMs = new Date(timeText.replace(" ", "T")).getTime();
    if (!Number.isFinite(parsedMs) || parsedMs <= Date.now()) {
      toastStore.pushToast({
        tone: "warning",
        title: t("toasts.pickFutureTime"),
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
      title: t("toasts.scheduledSetTitle", { time: formatTime(timeText) }),
      detail: t("toasts.scheduledSetDetail"),
    });
  };

  return (
    <ModalShell
      heading={t("compose.scheduleHeading")}
      subtitle={t("compose.scheduleSubtitle")}
      maxWidth={460}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {t("compose.scheduleFooterHint")}
          </span>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => applyTime(customTime)}
            >
              {t("compose.confirmTimeBtn")}
            </button>
          </div>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="provider-card"
            onClick={() => applyTime(p.value)}
          >
            <span className="row">
              <Icon name="clock" size={15} />
              <strong>{p.label}</strong>
            </span>
            <span className="text-xs text-muted">
              {isEn ? `${p.value} (${p.hint})` : `${p.value}（${p.hint}）`}
            </span>
          </button>
        ))}
      </div>

      <div className="settings-card">
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          {t("compose.customScheduleLabel")}
        </label>
        <DateTimePicker
          value={customTime}
          onChange={setCustomTime}
          ariaLabel={t("compose.customScheduleAria")}
        />
      </div>
    </ModalShell>
  );
}
