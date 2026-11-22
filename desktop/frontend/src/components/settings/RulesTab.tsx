import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function RulesTab() {
  const { workspace, toastStore } = useApp();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row-between">
        <div>
          <strong style={{ fontSize: 15 }}>
            收件规则与自动分拣（{workspace.rules.length}）
          </strong>
          <div className="text-xs text-muted">
            按发件人、域名、主题或附件条件自动归类、贴标签、标星或转入归档
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => workspace.setOverlay({ type: "rule-editor" })}
        >
          <Icon name="plus" size={14} /> 新建规则
        </button>
      </div>

      {workspace.rules.map((rule) => (
        <div key={rule.id} className="settings-card">
          <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{rule.name}</strong>
              <span className="pill pill-neutral">{rule.accountScope}</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  toastStore.pushToast({
                    tone: "success",
                    title: `已立即执行规则「${rule.name}」`,
                    detail: "已扫描本地收件箱并同步匹配标签",
                  })
                }
              >
                立即运行
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  workspace.setOverlay({ type: "rule-editor", ruleId: rule.id })
                }
              >
                编辑
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={rule.enabled}
                className={`switch-btn${rule.enabled ? " on" : ""}`}
                onClick={() => workspace.toggleRule(rule.id)}
              >
                <span className="switch-knob" />
              </button>
            </div>
          </div>
          <div
            className="text-xs"
            style={{ color: "var(--text-body)", lineHeight: 1.6 }}
          >
            <strong>条件：</strong>
            {rule.conditionSummary}
            <br />
            <strong>动作：</strong>
            {rule.actionSummary}
          </div>
          <div className="text-xs text-muted">
            近 7 天已命中 {rule.hitsLast7Days} 封邮件 ·{" "}
            {rule.enabled ? "规则生效中" : "已暂停"}
          </div>
        </div>
      ))}
    </div>
  );
}
