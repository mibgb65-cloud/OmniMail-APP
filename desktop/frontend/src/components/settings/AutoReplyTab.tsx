import { useApp } from "../../state/AppContext";
import { SwitchRow } from "./SwitchRow";

export function AutoReplyTab() {
  const { workspace, toastStore } = useApp();
  const ar = workspace.settings.autoReply;

  const updateAutoReply = (patch: Partial<typeof ar>) => {
    const next = { ...ar, ...patch };
    workspace.updateSettings({ autoReply: next });
    if ("enabled" in patch) {
      workspace.setBannerMode(next.enabled ? "auto-reply" : "none");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <SwitchRow
          title="启用外出 / 休假自动回复"
          desc="开启后工作台顶部将显示自动回复提示条，并按设定时间窗口响应来信"
          checked={ar.enabled}
          onChange={(v) => updateAutoReply({ enabled: v })}
        />

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">生效账户</label>
            <select
              className="select"
              style={{ marginTop: 4, width: "100%" }}
              value={ar.accountId}
              onChange={(e) => updateAutoReply({ accountId: e.target.value })}
            >
              {workspace.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">已自动回复计数</label>
            <div
              className="input row"
              style={{ marginTop: 4, background: "var(--bg-surface)" }}
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
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={ar.startTime}
              onChange={(e) => updateAutoReply({ startTime: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted">结束时间</label>
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={ar.endTime}
              onChange={(e) => updateAutoReply({ endTime: e.target.value })}
            />
          </div>
        </div>

        <SwitchRow
          title="仅回复通讯录联系人与同域名同事"
          desc="避免向群发订阅、自动通知与陌生推广地址泄露行程状态"
          checked={ar.contactsAndSameDomainOnly}
          onChange={(v) => updateAutoReply({ contactsAndSameDomainOnly: v })}
        />
        <SwitchRow
          title="同一发件人 4 天内最多回复一次（防循环）"
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
        <textarea
          className="textarea"
          rows={4}
          value={ar.body}
          onChange={(e) => updateAutoReply({ body: e.target.value })}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ alignSelf: "flex-end" }}
          onClick={() =>
            toastStore.pushToast({
              tone: "success",
              title: "自动回复设置已保存",
              detail: ar.enabled
                ? "顶部提示条已同步激活"
                : "当前处于未启用状态",
            })
          }
        >
          保存自动回复配置
        </button>
      </div>
    </div>
  );
}
