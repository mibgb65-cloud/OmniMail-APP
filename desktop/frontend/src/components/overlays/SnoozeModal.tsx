import { useState } from "react";
import { useI18n, type TranslationKey } from "../../i18n";
import { mailApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { DateTimePicker } from "../common/DateTimePicker";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

const SNOOZE_PRESETS: Array<readonly [TranslationKey, TranslationKey, number]> =
  [
    [
      "overlays.snoozePresetLaterToday",
      "overlays.snoozePresetIn3h",
      3 * 3600 * 1000,
    ],
    [
      "overlays.snoozePresetTomorrowMorning",
      "overlays.snoozePresetTomorrow9am",
      18 * 3600 * 1000,
    ],
    [
      "overlays.snoozePresetWeekend",
      "overlays.snoozePresetIn2d",
      48 * 3600 * 1000,
    ],
    [
      "overlays.snoozePresetNextMon",
      "overlays.snoozePresetIn4d",
      96 * 3600 * 1000,
    ],
  ];

export function SnoozeModal({ mailIds }: { mailIds: string[] }) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t } = useI18n();
  const [customTime, setCustomTime] = useState("2026-11-24 09:00");

  const apply = async (label: string, wakeMs: number) => {
    try {
      await mailApi.snoozeMessages(mailIds, wakeMs);
      mailStore.moveMails(mailIds, "snoozed", {
        snoozeUntil: label,
        statusBadge: t("overlays.snoozeBadgePrefix", { label }),
      });
      workspace.setOverlay({ type: "none" });
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.snoozedMailsTitle", {
          count: mailIds.length,
          label,
        }),
        detail: t("toasts.snoozedMailsDetail"),
      });
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.snoozeFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading={t("overlays.snoozeHeading")}
      subtitle={t("overlays.snoozeSubtitle", { count: mailIds.length })}
      maxWidth={440}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {t("overlays.snoozeFooterHint")}
          </span>
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
            {t("overlays.snoozeApplyCustomBtn")}
          </button>
        </>
      }
    >
      {SNOOZE_PRESETS.map(([labelKey, valKey, deltaMs]) => {
        const label = t(labelKey);
        const val = t(valKey);
        return (
          <button
            key={labelKey}
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
        );
      })}
      <div>
        <label className="text-xs text-muted">
          {t("overlays.snoozeCustomLabel")}
        </label>
        <DateTimePicker
          style={{ marginTop: 4 }}
          value={customTime}
          onChange={setCustomTime}
          ariaLabel={t("overlays.snoozeCustomAria")}
        />
      </div>
    </ModalShell>
  );
}
