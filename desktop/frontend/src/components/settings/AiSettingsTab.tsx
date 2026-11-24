import { useState } from "react";
import { useI18n } from "../../i18n";
import { profileApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { AppSettings } from "../../types/settings";
import { AiProviderCard } from "./ai/AiProviderCard";
import { SwitchRow } from "./SwitchRow";

export function AiSettingsModeBadge() {
  const {
    workspace: { settings },
  } = useApp();
  const { t } = useI18n();
  const automatic = settings.aiEnabled && settings.aiAutoSummarizeOnOpen;
  return (
    <span className={`pill ${automatic ? "pill-ai" : "pill-neutral"}`}>
      {!settings.aiEnabled
        ? t("settings.aiModeDisabled")
        : automatic
          ? t("settings.aiModeAutoSummarize")
          : t("settings.aiModeOnDemand")}
    </span>
  );
}

export function AiSettingsTab() {
  const { workspace, toastStore } = useApp();
  const { t } = useI18n();
  const s = workspace.settings;
  const [saving, setSaving] = useState(false);

  const savePrivacy = async (patch: Partial<AppSettings>) => {
    setSaving(true);
    try {
      // 后端确认保存后再改变提示，避免开关与真正发送范围不一致。
      await profileApi.updateAppSettings(patch);
      workspace.applySettingsFromBackend(patch);
    } catch {
      toastStore.pushToast({
        tone: "warning",
        title: t("settings.aiSavePrivacyFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          {t("settings.aiPrivacySection")}
        </strong>
        <SwitchRow
          heading={t("settings.aiEnableTitle")}
          desc={t("settings.aiEnableDesc")}
          checked={s.aiEnabled}
          disabled={saving}
          onChange={(v) => void savePrivacy({ aiEnabled: v })}
        />
        <SwitchRow
          heading={t("settings.aiAutoSummarizeTitle")}
          desc={t("settings.aiAutoSummarizeDesc")}
          checked={s.aiAutoSummarizeOnOpen}
          disabled={saving || !s.aiEnabled}
          onChange={(v) => void savePrivacy({ aiAutoSummarizeOnOpen: v })}
        />
        <div className="text-xs text-muted">
          {t("settings.aiAutoSummarizeFootnote")}
        </div>
        <SwitchRow
          heading={t("settings.aiConfirmEachTimeTitle")}
          desc={t("settings.aiConfirmEachTimeDesc")}
          checked={s.aiRequireConfirmEachTime}
          disabled={saving}
          onChange={(v) => void savePrivacy({ aiRequireConfirmEachTime: v })}
        />
        <SwitchRow
          heading={t("settings.aiIncludeSubjectTitle")}
          desc={t("settings.aiIncludeSubjectDesc")}
          checked={s.aiIncludeSenderAndAttachments}
          disabled={saving}
          onChange={(v) =>
            void savePrivacy({ aiIncludeSenderAndAttachments: v })
          }
        />
      </div>

      <AiProviderCard key={workspace.activeProfileId} />
    </div>
  );
}
