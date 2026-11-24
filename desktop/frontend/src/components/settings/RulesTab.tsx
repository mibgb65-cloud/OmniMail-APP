import { useI18n } from "../../i18n";
import { parseBackendError, ruleApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function RulesTab() {
  const { workspace, mailStore, toastStore } = useApp();
  const { t } = useI18n();

  const handleRunNow = (ruleId: string, ruleName: string) => {
    void ruleApi
      .runRuleNow(ruleId)
      .then(async (hitCount) => {
        const freshRules = await ruleApi.listRules();
        workspace.setRules(freshRules);
        void mailStore.reloadMessages();
        toastStore.pushToast({
          tone: "success",
          title: t("toasts.ruleExecutedTitle", { name: ruleName }),
          detail: t("toasts.ruleExecutedDetail", { count: hitCount }),
        });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: t("toasts.runRuleFailed"),
          detail: parseBackendError(err).message,
        }),
      );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row-between">
        <div>
          <strong style={{ fontSize: 15 }}>
            {t("settings.rulesHeading", { count: workspace.rules.length })}
          </strong>
          <div className="text-xs text-muted">{t("settings.rulesDesc")}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => workspace.setOverlay({ type: "rule-editor" })}
        >
          <Icon name="plus" size={14} /> {t("settings.newRuleBtn")}
        </button>
      </div>

      {workspace.rules.map((rule) => (
        <div key={rule.id} className="settings-card">
          <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{rule.name}</strong>
              <span className="pill pill-neutral">
                {rule.accountScope === "all"
                  ? t("settings.allAccountsBadge")
                  : rule.accountScope}
              </span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleRunNow(rule.id, rule.name)}
              >
                {t("settings.runNowBtn")}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  workspace.setOverlay({ type: "rule-editor", ruleId: rule.id })
                }
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={rule.enabled}
                aria-label={rule.name}
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
            <strong>{t("settings.conditionLabel")}</strong>
            {rule.conditionSummary}
            <br />
            <strong>{t("settings.actionLabel")}</strong>
            {rule.actionSummary}
          </div>
          <div className="text-xs text-muted">
            {t("settings.ruleHitsRow", {
              hits: rule.hitsLast7Days,
              status: rule.enabled
                ? t("settings.ruleStatusActive")
                : t("settings.ruleStatusPaused"),
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
