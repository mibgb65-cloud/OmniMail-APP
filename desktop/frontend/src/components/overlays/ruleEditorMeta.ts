import {
  getCurrentLanguage,
  translateWithLang,
  type TranslationKey,
} from "../../i18n";
import type { LanguageCode } from "../../types/settings";
import type { InboxRule } from "../../types/workspace";

const CONDITION_FIELD_KEYS: Array<readonly [string, TranslationKey]> = [
  ["sender", "overlays.ruleCondSender"],
  ["subject", "overlays.ruleCondSubject"],
  ["body", "overlays.ruleCondBody"],
  ["attachment_ext", "overlays.ruleCondAttExt"],
];

const ACTION_TYPE_KEYS: Array<readonly [string, TranslationKey]> = [
  ["archive", "overlays.ruleActArchive"],
  ["add_label", "overlays.ruleActAddLabel"],
  ["star", "overlays.ruleActStar"],
  ["mark_read", "overlays.ruleActMarkRead"],
  ["delete", "overlays.ruleActDelete"],
];

export function getConditionFieldOptions(
  lang: LanguageCode = getCurrentLanguage(),
) {
  return CONDITION_FIELD_KEYS.map(([value, key]) => ({
    value,
    label: translateWithLang(lang, key),
  }));
}

export function getActionTypeOptions(
  lang: LanguageCode = getCurrentLanguage(),
) {
  return ACTION_TYPE_KEYS.map(([value, key]) => ({
    value,
    label: translateWithLang(lang, key),
  }));
}

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
  lang: LanguageCode = getCurrentLanguage(),
): InboxRule {
  const condOptions = getConditionFieldOptions(lang);
  const actOptions = getActionTypeOptions(lang);
  const fLabel =
    condOptions.find((f) => f.value === fields.conditionField)?.label ??
    fields.conditionField;
  const aLabel =
    actOptions.find((a) => a.value === fields.actionType)?.label ??
    fields.actionType;
  const val = fields.conditionValue.trim();
  const condSummary =
    lang === "en-US" ? `${fLabel} “${val}”` : `${fLabel}「${val}」`;
  return {
    id: existing?.id ?? "",
    name:
      fields.name.trim() ||
      translateWithLang(lang, "overlays.ruleUnnamedFallback"),
    enabled: existing?.enabled ?? true,
    matchMode: "AND",
    accountScope: fields.accountScope,
    conditionSummary: condSummary,
    actionSummary: `${aLabel}${fields.actionTarget ? ` (${fields.actionTarget})` : ""}`,
    conditionField: fields.conditionField,
    conditionOperator: "contains",
    conditionValue: val,
    actionType: fields.actionType,
    actionTarget: fields.actionTarget.trim(),
    stopMatching: fields.stopMatching,
    hitsLast7Days: existing?.hitsLast7Days ?? 0,
  };
}
