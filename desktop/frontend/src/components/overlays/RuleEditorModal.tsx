import { useState } from "react";
import {
  parseBackendError,
  ruleApi,
  type RulePreviewResult,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { CustomSelect } from "../common/CustomSelect";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";
import { RuleEditorFooter, RulePreviewCard } from "./RuleEditorFooter";
import {
  ACTION_TYPES,
  buildInboxRuleDraft,
  CONDITION_FIELDS,
} from "./ruleEditorMeta";

export function RuleEditorModal({ ruleId }: { ruleId?: string }) {
  const { workspace, mailStore, toastStore } = useApp();
  const existing = workspace.rules.find((r) => r.id === ruleId);

  const [name, setName] = useState(existing?.name ?? "");
  const [accountScope, setAccountScope] = useState(
    existing?.accountScope ?? "all",
  );
  const [conditionField, setConditionField] = useState(
    existing?.conditionField && existing.conditionField.length < 20
      ? existing.conditionField
      : "sender",
  );
  const [conditionValue, setConditionValue] = useState(
    existing?.conditionValue ?? "",
  );
  const [actionType, setActionType] = useState(
    existing?.actionType && existing.actionType.length < 20
      ? existing.actionType
      : "archive",
  );
  const [actionTarget, setActionTarget] = useState(
    existing?.actionTarget ?? mailStore.labels[0]?.id ?? "",
  );
  const [stopMatching, setStopMatching] = useState(
    existing?.stopMatching ?? true,
  );
  const [preview, setPreview] = useState<RulePreviewResult | null>(null);

  const closeToRules = () =>
    workspace.setOverlay({ type: "settings", tab: "rules" });

  const currentDraft = () =>
    buildInboxRuleDraft(existing, {
      name,
      accountScope,
      conditionField,
      conditionValue,
      actionType,
      actionTarget,
      stopMatching,
    });

  return (
    <ModalShell
      heading={existing ? "编辑收件规则" : "新建收件规则"}
      subtitle="按条件自动为新收邮件归档、贴标签或标记已读"
      maxWidth={560}
      onClose={closeToRules}
      footer={
        <RuleEditorFooter
          hasExisting={Boolean(existing)}
          canPreview={Boolean(conditionValue.trim())}
          canSave={Boolean(name.trim() && conditionValue.trim())}
          onDelete={() => {
            if (existing) workspace.deleteRule(existing.id);
            closeToRules();
          }}
          onPreview={() => {
            void ruleApi
              .previewRule(currentDraft())
              .then(setPreview)
              .catch((err) =>
                toastStore.pushToast({
                  tone: "danger",
                  title: "干跑预览失败",
                  detail: parseBackendError(err).message,
                }),
              );
          }}
          onCancel={closeToRules}
          onSave={() => {
            workspace.upsertRule(currentDraft());
            closeToRules();
            toastStore.pushToast({
              tone: "success",
              title: `已保存收件规则「${name.trim()}」`,
            });
          }}
        />
      }
    >
      <div>
        <label className="text-xs text-muted">规则名称 *</label>
        <input
          className="input"
          style={{ marginTop: 4 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如 报销单据自动归档"
        />
      </div>

      <div>
        <label className="text-xs text-muted">适用邮箱范围</label>
        <CustomSelect
          fullWidth
          style={{ marginTop: 4 }}
          value={accountScope}
          ariaLabel="适用邮箱范围"
          options={[
            {
              value: "all",
              label: `全部已连接邮箱 (${workspace.accounts.length})`,
            },
            ...workspace.accounts.map((acc) => ({
              value: acc.id,
              label: acc.name,
              sublabel: acc.email,
              icon: <ProviderIcon provider={acc.provider} size={18} />,
            })),
          ]}
          onChange={setAccountScope}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">匹配字段</label>
          <CustomSelect
            fullWidth
            style={{ marginTop: 4 }}
            value={conditionField}
            options={CONDITION_FIELDS}
            ariaLabel="规则匹配字段"
            onChange={setConditionField}
          />
        </div>
        <div>
          <label className="text-xs text-muted">匹配关键词 / 后缀 *</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={conditionValue}
            onChange={(e) => setConditionValue(e.target.value)}
            placeholder="例如 发票 或 pdf"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">执行动作</label>
          <CustomSelect
            fullWidth
            style={{ marginTop: 4 }}
            value={actionType}
            options={ACTION_TYPES}
            ariaLabel="规则执行动作"
            onChange={setActionType}
          />
        </div>
        <div>
          <label className="text-xs text-muted">目标标签 ID（选填）</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={actionTarget}
            onChange={(e) => setActionTarget(e.target.value)}
            placeholder="当动作选添加标签时填写标签 ID"
          />
        </div>
      </div>

      <Checkbox
        checked={stopMatching}
        onChange={setStopMatching}
        ariaLabel="命中本规则后停止匹配后续规则"
      >
        命中本规则后停止匹配后续低优先级规则
      </Checkbox>

      {preview && <RulePreviewCard preview={preview} />}
    </ModalShell>
  );
}
