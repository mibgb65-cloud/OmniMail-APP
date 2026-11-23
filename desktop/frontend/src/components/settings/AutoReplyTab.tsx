import { FadeTextarea } from "../common/scroll-fade/FadeTextarea";
import { useState } from "react";
import { parseBackendError, ruleApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { CustomSelect } from "../common/CustomSelect";
import { DateTimePicker } from "../common/DateTimePicker";
import { ProviderIcon } from "../common/ProviderIcon";
import { SwitchRow } from "./SwitchRow";

export function AutoReplyTab() {
  const { workspace, toastStore } = useApp();
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
          heading="启用外出 / 休假自动回复"
          desc="开启后工作台顶部将显示自动回复提示条，并按设定时间窗口响应来信"
          checked={ar.enabled}
          onChange={(v) => updateAutoReply({ enabled: v })}
        />

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">生效账户</label>
            <CustomSelect
              fullWidth
              minMenuWidth={220}
              style={{ marginTop: 4 }}
              value={ar.accountId}
              ariaLabel="自动回复生效账户"
              options={workspace.accounts.map((acc) => ({
                value: acc.id,
                label: acc.name,
                sublabel: acc.email,
                icon: <ProviderIcon provider={acc.provider} size={18} />,
              }))}
              onChange={(val) => updateAutoReply({ accountId: val })}
            />
          </div>
          <div>
            <label className="text-xs text-muted">已自动回复计数</label>
            <div
              className="input row"
              style={{
                marginTop: 4,
                height: 36,
                background: "var(--bg-surface)",
              }}
            >
              本次休假周期累计回复 {ar.repliedCount} 位发件人
            </div>
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">开始时间</label>
            <DateTimePicker
              style={{ marginTop: 4 }}
              value={ar.startTime}
              onChange={(val) => updateAutoReply({ startTime: val })}
              ariaLabel="自动回复开始时间"
            />
          </div>
          <div>
            <label className="text-xs text-muted">结束时间</label>
            <DateTimePicker
              style={{ marginTop: 4 }}
              value={ar.endTime}
              onChange={(val) => updateAutoReply({ endTime: val })}
              ariaLabel="自动回复结束时间"
            />
          </div>
        </div>

        <SwitchRow
          heading="仅回复通讯录联系人与同域名同事"
          desc="避免向群发订阅、自动通知与陌生推广地址泄露行程状态"
          checked={ar.contactsAndSameDomainOnly}
          onChange={(v) => updateAutoReply({ contactsAndSameDomainOnly: v })}
        />
        <SwitchRow
          heading="同一发件人 4 天内最多回复一次（防循环）"
          desc="自动跳过 List-Unsubscribe / Auto-Submitted 邮件头，防止回复死循环"
          checked={ar.limitOncePer4Days}
          onChange={(v) => updateAutoReply({ limitOncePer4Days: v })}
        />
      </div>

      <div className="settings-card">
        <label className="text-xs text-muted">自动回复主题</label>
        <input
          className="input"
          value={ar.subject}
          onChange={(e) => updateAutoReply({ subject: e.target.value })}
        />
        <label className="text-xs text-muted">自动回复正文</label>
        <FadeTextarea
          aria-label="自动回复正文"
          className="textarea"
          rows={4}
          value={ar.body}
          onChange={(e) => updateAutoReply({ body: e.target.value })}
        />
        <AsyncActionButton
          size="sm"
          status={saveStatus}
          style={{ alignSelf: "flex-end" }}
          idleLabel="保存自动回复配置"
          loadingLabel="正在保存配置…"
          successLabel="自动回复已保存"
          errorLabel="保存失败 · 重试"
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
                  title: "自动回复设置已保存",
                  detail: ar.enabled
                    ? "RFC3834 防循环与 4 天频控已同步激活"
                    : "当前处于未启用状态",
                });
              })
              .catch((err) => {
                setSaveStatus("error");
                toastStore.pushToast({
                  tone: "danger",
                  title: "保存失败",
                  detail: parseBackendError(err).message,
                });
              });
          }}
        />
      </div>
    </div>
  );
}
