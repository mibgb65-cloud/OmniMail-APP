import type {
  InboxRuleDTO,
  RulePreviewResult,
} from "../../bindings/omnimail/internal/rules/models";
import * as RuleService from "../../bindings/omnimail/services/ruleservice";
import { INITIAL_RULES } from "../data/rulesAndDiagnostics";
import { INITIAL_SETTINGS } from "../data/settingsDefaults";
import { isWailsDesktop } from "../state/storageHelpers";
import type { AutoReplyConfig } from "../types/settings";
import type { InboxRule } from "../types/workspace";

export type { RulePreviewResult };

function mapRuleDTO(r: InboxRuleDTO): InboxRule {
  return {
    id: r.id,
    name: r.name,
    enabled: Boolean(r.enabled),
    matchMode: r.matchMode === "OR" ? "OR" : "AND",
    accountScope: r.accountScope || "all",
    conditionSummary: r.conditionSummary ?? "",
    actionSummary: r.actionSummary ?? "",
    conditionField: r.conditionField ?? "sender",
    conditionOperator: r.conditionOperator ?? "contains",
    conditionValue: r.conditionValue ?? "",
    attachmentExt: r.attachmentExt,
    actionType: r.actionType ?? "archive",
    actionTarget: r.actionTarget ?? "",
    stopMatching: Boolean(r.stopMatching),
    hitsLast7Days: r.hitsLast7Days ?? 0,
  };
}

function toBackendRule(r: InboxRule): InboxRuleDTO {
  return {
    ...r,
    priority: 0,
    attachmentExt: r.attachmentExt ?? "",
    conditions: [],
    actions: [],
  };
}

export const ruleApi = {
  async listRules(): Promise<InboxRule[]> {
    if (!isWailsDesktop()) return INITIAL_RULES;
    const rows = await RuleService.ListRules();
    return (rows ?? []).map(mapRuleDTO);
  },

  async saveRule(rule: InboxRule): Promise<InboxRule> {
    if (!isWailsDesktop()) return rule;
    const saved = await RuleService.SaveRule(toBackendRule(rule));
    return mapRuleDTO(saved);
  },

  async deleteRule(id: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await RuleService.DeleteRule(id);
  },

  async reorderRules(ids: string[]): Promise<void> {
    if (!isWailsDesktop()) return;
    await RuleService.ReorderRules(ids);
  },

  async previewRule(rule: InboxRule): Promise<RulePreviewResult> {
    if (!isWailsDesktop()) {
      return {
        hitCount: 2,
        samples: [
          {
            id: "s-1",
            subject: "示例命中邮件预览",
            senderEmail: "demo@example.com",
          },
        ],
      };
    }
    return RuleService.PreviewRule(toBackendRule(rule));
  },

  async runRuleNow(ruleId: string): Promise<number> {
    if (!isWailsDesktop()) return 1;
    return RuleService.RunRuleNow(ruleId);
  },

  async getAutoReplyConfig(): Promise<AutoReplyConfig> {
    if (!isWailsDesktop()) return INITIAL_SETTINGS.autoReply;
    return RuleService.GetAutoReplyConfig();
  },

  async saveAutoReplyConfig(cfg: AutoReplyConfig): Promise<AutoReplyConfig> {
    if (!isWailsDesktop()) return cfg;
    return RuleService.SaveAutoReplyConfig(cfg);
  },
};
