import type { InboxRule } from "../../types/workspace";

export const CONDITION_FIELDS = [
  { value: "sender", label: "发件人包含" },
  { value: "subject", label: "邮件主题包含" },
  { value: "body", label: "正文内容包含" },
  { value: "attachment_ext", label: "附件扩展名等于" },
];

export const ACTION_TYPES = [
  { value: "archive", label: "自动归档" },
  { value: "add_label", label: "添加自定义标签" },
  { value: "star", label: "自动标星" },
  { value: "mark_read", label: "标记为已读" },
  { value: "delete", label: "移入回收站" },
];

export function buildInboxRuleDraft(
  existing: InboxRule | undefined,
  fields: {
    name: string;
    accountScope: string;
    conditionField: string;
    conditionValue: string;
    actionType: string;
    actionTarget: string;
    stopMatching: boolean;
  },
): InboxRule {
  const fLabel =
    CONDITION_FIELDS.find((f) => f.value === fields.conditionField)?.label ??
    fields.conditionField;
  const aLabel =
    ACTION_TYPES.find((a) => a.value === fields.actionType)?.label ??
    fields.actionType;
  return {
    id: existing?.id ?? "",
    name: fields.name.trim() || "未命名规则",
    enabled: existing?.enabled ?? true,
    matchMode: "AND",
    accountScope: fields.accountScope,
    conditionSummary: `${fLabel}「${fields.conditionValue.trim()}」`,
    actionSummary: `${aLabel}${fields.actionTarget ? ` (${fields.actionTarget})` : ""}`,
    conditionField: fields.conditionField,
    conditionOperator: "contains",
    conditionValue: fields.conditionValue.trim(),
    actionType: fields.actionType,
    actionTarget: fields.actionTarget.trim(),
    stopMatching: fields.stopMatching,
    hitsLast7Days: existing?.hitsLast7Days ?? 0,
  };
}
