import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { ModalShell } from "../common/ModalShell";

export function RuleEditorModal({ ruleId }: { ruleId?: string }) {
  const { workspace, toastStore } = useApp();
  const existing = workspace.rules.find((r) => r.id === ruleId);

  const [name, setName] = useState(existing?.name ?? "");
  const [accountScope, setAccountScope] = useState(
    existing?.accountScope ?? `全部已连接邮箱 (${workspace.accounts.length})`,
  );
  const [conditionField, setConditionField] = useState(
    existing?.conditionField ?? "发件人",
  );
  const [conditionValue, setConditionValue] = useState(
    existing?.conditionValue ?? "",
  );
  const [actionType, setActionType] = useState(
    existing?.actionType ?? "添加自定义标签",
  );
  const [actionTarget, setActionTarget] = useState(
    existing?.actionTarget ?? "项目协作",
  );
  const [stopMatching, setStopMatching] = useState(
    existing?.stopMatching ?? true,
  );

  const handleSave = () => {
    if (!name.trim() || !conditionValue.trim()) return;
    workspace.upsertRule({
      id: existing?.id ?? `rule-${Date.now()}`,
      name: name.trim(),
      enabled: existing?.enabled ?? true,
      matchMode: "AND",
      accountScope,
      conditionSummary: `${conditionField}包含「${conditionValue.trim()}」`,
      actionSummary: `${actionType}「${actionTarget.trim()}」`,
      conditionField,
      conditionOperator: "包含",
      conditionValue: conditionValue.trim(),
      actionType,
      actionTarget: actionTarget.trim(),
      stopMatching,
      hitsLast7Days: existing?.hitsLast7Days ?? 0,
    });
    workspace.setOverlay({ type: "settings", tab: "rules" });
    toastStore.pushToast({
      tone: "success",
      title: `已保存收件规则「${name.trim()}」`,
    });
  };

  return (
    <ModalShell
      title={existing ? "编辑收件规则" : "新建收件规则"}
      subtitle="按条件自动为新收邮件添加标签、归档或标记 VIP"
      maxWidth={560}
      onClose={() => workspace.setOverlay({ type: "settings", tab: "rules" })}
      footer={
        <>
          {existing ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                workspace.deleteRule(existing.id);
                workspace.setOverlay({ type: "settings", tab: "rules" });
                toastStore.pushToast({
                  tone: "info",
                  title: `已删除规则「${existing.name}」`,
                });
              }}
            >
              删除规则
            </button>
          ) : (
            <span className="text-xs text-muted">保存后立即对新收邮件生效</span>
          )}
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                workspace.setOverlay({ type: "settings", tab: "rules" })
              }
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!name.trim() || !conditionValue.trim()}
              onClick={handleSave}
            >
              保存规则
            </button>
          </div>
        </>
      }
    >
      <div>
        <label className="text-xs text-muted">规则名称 *</label>
        <input
          className="input"
          style={{ marginTop: 4 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如 报销单据自动打标"
        />
      </div>

      <div>
        <label className="text-xs text-muted">适用邮箱范围</label>
        <select
          className="select"
          style={{ marginTop: 4, width: "100%" }}
          value={accountScope}
          onChange={(e) => setAccountScope(e.target.value)}
        >
          <option value={`全部已连接邮箱 (${workspace.accounts.length})`}>
            全部已连接邮箱 ({workspace.accounts.length})
          </option>
          {workspace.accounts.map((acc) => (
            <option key={acc.id} value={acc.name}>
              {acc.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">匹配字段</label>
          <select
            className="select"
            style={{ marginTop: 4, width: "100%" }}
            value={conditionField}
            onChange={(e) => setConditionField(e.target.value)}
          >
            <option value="发件人">发件人</option>
            <option value="邮件主题">邮件主题</option>
            <option value="联系人分组">联系人分组</option>
            <option value="附件后缀">附件后缀</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">包含关键词 *</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={conditionValue}
            onChange={(e) => setConditionValue(e.target.value)}
            placeholder="例如 发票, 报销"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">执行动作</label>
          <select
            className="select"
            style={{ marginTop: 4, width: "100%" }}
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
          >
            <option value="添加自定义标签">添加自定义标签</option>
            <option value="移动到文件夹">移动到文件夹</option>
            <option value="标记邮件状态">标记邮件状态</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">动作目标</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={actionTarget}
            onChange={(e) => setActionTarget(e.target.value)}
          />
        </div>
      </div>

      <label className="row" style={{ fontSize: 13, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={stopMatching}
          onChange={(e) => setStopMatching(e.target.checked)}
        />
        <span>命中本规则后停止匹配后续规则</span>
      </label>
    </ModalShell>
  );
}
