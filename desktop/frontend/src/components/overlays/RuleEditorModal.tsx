import { useState } from "react";
import { useI18n } from "../../i18n";
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
import {
  RuleEditorFooter,
  RuleFieldRow,
  RulePreviewCard,
} from "./RuleEditorFooter";
import {
  buildInboxRuleDraft,
  getActionTypeOptions,
  getConditionFieldOptions,
} from "./ruleEditorMeta";

export function RuleEditorModal({ ruleId }: { ruleId?: string }) {
  const { workspace, mailStore, toastStore } = useApp();
  const { lang, t } = useI18n();
  const existing = workspace.rules.find((r) => r.id === ruleId);

  const [name, setName] = useState(existing?.name ?? "");
  const [accountScope, setAccountScope] = useState(
    existing?.accountScope ?? "all",
  );
  const initCond =
    existing?.conditionField && existing.conditionField.length < 20
      ? existing.conditionField
      : "sender";
  const initAct =
    existing?.actionType && existing.actionType.length < 20
      ? existing.actionType
      : "archive";
  const [conditionField, setConditionField] = useState(initCond);
  const [conditionValue, setConditionValue] = useState(
    existing?.conditionValue ?? "",
  );
  const [actionType, setActionType] = useState(initAct);
  const [actionTarget, setActionTarget] = useState(
    existing?.actionTarget ?? mailStore.labels[0]?.id ?? "",
  );
  const [stopMatching, setStopMatching] = useState(
    existing?.stopMatching ?? true,
  );
  const [preview, setPreview] = useState<RulePreviewResult | null>(null);

  const closeToRules = () =>
    workspace.setOverlay({ type: "settings", tab: "rules" });
  const formVal = {
    name,
    accountScope,
    conditionField,
    conditionValue,
    actionType,
    actionTarget,
    stopMatching,
  };
  const currentDraft = () => buildInboxRuleDraft(existing, formVal, lang);
  const scopeOptions = [
    {
      value: "all",
      label: t("overlays.ruleAllAccountsCountOpt", {
        count: workspace.accounts.length,
      }),
    },
    ...workspace.accounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
      sublabel: acc.email,
      icon: <ProviderIcon provider={acc.provider} size={18} />,
    })),
  ];
  const runPreview = () => {
    void ruleApi
      .previewRule(currentDraft())
      .then(setPreview)
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: t("toasts.dryRunFailed"),
          detail: parseBackendError(err).message,
        }),
      );
  };
  const runSave = () => {
    workspace.upsertRule(currentDraft());
    closeToRules();
    toastStore.pushToast({
      tone: "success",
      title: t("toasts.savedInboxRule", { name: name.trim() }),
    });
  };

  return (
    <ModalShell
      heading={
        existing ? t("overlays.ruleEditHeading") : t("overlays.ruleNewHeading")
      }
      subtitle={t("overlays.ruleSubtitle")}
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
          onPreview={runPreview}
          onCancel={closeToRules}
          onSave={runSave}
        />
      }
    >
      <RuleFieldRow label={t("overlays.ruleNameLabel")}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("overlays.ruleNamePlaceholder")}
        />
      </RuleFieldRow>
      <RuleFieldRow label={t("overlays.ruleScopeLabel")}>
        <CustomSelect
          fullWidth
          value={accountScope}
          ariaLabel={t("overlays.ruleScopeLabel")}
          options={scopeOptions}
          onChange={setAccountScope}
        />
      </RuleFieldRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <RuleFieldRow label={t("overlays.ruleCondFieldLabel")}>
          <CustomSelect
            fullWidth
            value={conditionField}
            options={getConditionFieldOptions(lang)}
            ariaLabel={t("overlays.ruleCondFieldAria")}
            onChange={setConditionField}
          />
        </RuleFieldRow>
        <RuleFieldRow label={t("overlays.ruleCondValLabel")}>
          <input
            className="input"
            value={conditionValue}
            onChange={(e) => setConditionValue(e.target.value)}
            placeholder={t("overlays.ruleCondValPlaceholder")}
          />
        </RuleFieldRow>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <RuleFieldRow label={t("overlays.ruleActionLabel")}>
          <CustomSelect
            fullWidth
            value={actionType}
            options={getActionTypeOptions(lang)}
            ariaLabel={t("overlays.ruleActionAria")}
            onChange={setActionType}
          />
        </RuleFieldRow>
        <RuleFieldRow label={t("overlays.ruleTargetLabelId")}>
          <input
            className="input"
            value={actionTarget}
            onChange={(e) => setActionTarget(e.target.value)}
            placeholder={t("overlays.ruleTargetLabelPlaceholder")}
          />
        </RuleFieldRow>
      </div>
      <Checkbox
        checked={stopMatching}
        onChange={setStopMatching}
        ariaLabel={t("overlays.ruleStopMatchingAria")}
      >
        {t("overlays.ruleStopMatchingLabel")}
      </Checkbox>
      {preview && <RulePreviewCard preview={preview} />}
    </ModalShell>
  );
}
