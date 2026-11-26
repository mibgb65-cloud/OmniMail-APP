import { useState } from "react";
import { useI18n } from "../../i18n";
import { parseBackendError, ruleApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { resolveSidebarAccountTitle } from "../../utils/accountDisplay";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { CustomSelect } from "../common/CustomSelect";
import { DateTimePicker } from "../common/DateTimePicker";
import { ProviderIcon } from "../common/ProviderIcon";
import { FadeTextarea } from "../common/scroll-fade/FadeTextarea";
import { SwitchRow } from "./SwitchRow";

export function AutoReplyTab() {
  const { workspace, toastStore } = useApp();
  const { lang, t } = useI18n();
  const ar = workspace.settings.autoReply;
  const [saveStatus, setSaveStatus] = useState<AsyncActionStatus>("idle");

  const updateAutoReply = (patch: Partial<typeof ar>) => {
    const next = { ...ar, ...patch };
    workspace.updateSettings({ autoReply: next });
    void ruleApi.saveAutoReplyConfig(next).catch(() => undefined);
    if ("enabled" in patch) {
      workspace.setBannerMode(next.enabled ? "auto-reply" : "none");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <SwitchRow
          heading={t("settings.autoReplyEnableTitle")}
          desc={t("settings.autoReplyEnableDesc")}
          checked={ar.enabled}
          onChange={(v) => updateAutoReply({ enabled: v })}
        />

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">
              {t("settings.autoReplyAccountLabel")}
            </label>
            <CustomSelect
              fullWidth
              showSublabelInTrigger
              minMenuWidth={280}
              style={{ marginTop: 4 }}
              value={ar.accountId}
              ariaLabel={t("settings.autoReplyAccountAria")}
              options={workspace.accounts.map((acc) => ({
                value: acc.id,
                label: resolveSidebarAccountTitle(acc, lang),
                sublabel: acc.email,
                icon: <ProviderIcon provider={acc.provider} size={18} />,
              }))}
              onChange={(val) => updateAutoReply({ accountId: val })}
            />
          </div>
          <div>
            <label className="text-xs text-muted">
              {t("settings.autoReplyCountLabel")}
            </label>
            <div
              className="input row"
              style={{
                marginTop: 4,
                height: 36,
                background: "var(--bg-surface)",
              }}
            >
              {t("settings.autoReplyCountText", { count: ar.repliedCount })}
            </div>
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">
              {t("settings.autoReplyStartLabel")}
            </label>
            <DateTimePicker
              style={{ marginTop: 4 }}
              value={ar.startTime}
              onChange={(val) => updateAutoReply({ startTime: val })}
              ariaLabel={t("settings.autoReplyStartAria")}
            />
          </div>
          <div>
            <label className="text-xs text-muted">
              {t("settings.autoReplyEndLabel")}
            </label>
            <DateTimePicker
              style={{ marginTop: 4 }}
              value={ar.endTime}
              onChange={(val) => updateAutoReply({ endTime: val })}
              ariaLabel={t("settings.autoReplyEndAria")}
            />
          </div>
        </div>

        <SwitchRow
          heading={t("settings.autoReplyContactsOnlyTitle")}
          desc={t("settings.autoReplyContactsOnlyDesc")}
          checked={ar.contactsAndSameDomainOnly}
          onChange={(v) => updateAutoReply({ contactsAndSameDomainOnly: v })}
        />
        <SwitchRow
          heading={t("settings.autoReplyLimit4dTitle")}
          desc={t("settings.autoReplyLimit4dDesc")}
          checked={ar.limitOncePer4Days}
          onChange={(v) => updateAutoReply({ limitOncePer4Days: v })}
        />
      </div>

      <div className="settings-card">
        <label className="text-xs text-muted">
          {t("settings.autoReplySubjectLabel")}
        </label>
        <input
          className="input"
          value={ar.subject}
          onChange={(e) => updateAutoReply({ subject: e.target.value })}
        />
        <label className="text-xs text-muted">
          {t("settings.autoReplyBodyLabel")}
        </label>
        <FadeTextarea
          aria-label={t("settings.autoReplyBodyLabel")}
          className="textarea"
          rows={4}
          value={ar.body}
          onChange={(e) => updateAutoReply({ body: e.target.value })}
        />
        <AsyncActionButton
          size="sm"
          status={saveStatus}
          style={{ alignSelf: "flex-end" }}
          idleLabel={t("settings.autoReplySaveIdle")}
          loadingLabel={t("settings.autoReplySaveLoading")}
          successLabel={t("settings.autoReplySaveSuccess")}
          errorLabel={t("settings.saveIdentityError")}
          successHoldMs={900}
          onSuccessHoldEnd={() => setSaveStatus("idle")}
          onClick={() => {
            setSaveStatus("loading");
            void ruleApi
              .saveAutoReplyConfig(ar)
              .then(() => {
                setSaveStatus("success");
                toastStore.pushToast({
                  tone: "success",
                  title: t("toasts.autoReplySavedTitle"),
                  detail: ar.enabled
                    ? t("toasts.autoReplyActiveDetail")
                    : t("toasts.autoReplyInactiveDetail"),
                });
              })
              .catch((err) => {
                setSaveStatus("error");
                toastStore.pushToast({
                  tone: "danger",
                  title: t("toasts.saveFailedGeneric"),
                  detail: parseBackendError(err).message,
                });
              });
          }}
        />
      </div>
    </div>
  );
}
