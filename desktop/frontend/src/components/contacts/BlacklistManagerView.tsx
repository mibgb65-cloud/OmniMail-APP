import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function BlacklistManagerView() {
  const { workspace, toastStore } = useApp();
  const [newRule, setNewRule] = useState("");
  const [reason, setReason] = useState("垃圾推广或异常发件人");

  const handleAdd = () => {
    const target = newRule.trim();
    if (!target) return;
    workspace.addBlacklist({
      target,
      kind: target.startsWith("*@") ? "domain" : "address",
      reason: reason.trim() || "手动添加拦截",
      blockedCount: 0,
      addedAt: "2026-11-20",
    });
    setNewRule("");
    toastStore.pushToast({
      tone: "success",
      title: `已添加拦截规则：${target}`,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 14 }}>黑名单与域名拦截</strong>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
              匹配的发件人或域名邮件将自动转入垃圾邮件，并禁用 Omni AI
              与远程图片加载
            </div>
          </div>
          <span className="pill pill-danger">
            {workspace.blacklist.length} 条生效中
          </span>
        </div>
        <div className="row" style={{ minWidth: 0 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 0 }}
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="输入邮箱或域名通配符，例如 *@promo.invalid"
          />
          <input
            className="input"
            style={{ width: 180, minWidth: 0 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="拦截备注"
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
            onClick={handleAdd}
          >
            <Icon name="plus" size={14} /> 添加拦截
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {workspace.blacklist.map((entry) => (
          <div key={entry.id} className="settings-card">
            <div className="row-between">
              <div className="row">
                <span className="pill pill-danger">
                  {entry.kind === "domain" ? "域名拦截" : "地址拦截"}
                </span>
                <strong style={{ fontSize: 14 }}>{entry.target}</strong>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  workspace.removeBlacklist(entry.id);
                  toastStore.pushToast({
                    tone: "info",
                    title: `已解除拦截：${entry.target}`,
                  });
                }}
              >
                移出黑名单
              </button>
            </div>
            <div className="row-between text-xs text-muted">
              <span>{entry.reason}</span>
              <span>
                累计拦截 {entry.blockedCount} 封 · 添加于 {entry.addedAt}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
