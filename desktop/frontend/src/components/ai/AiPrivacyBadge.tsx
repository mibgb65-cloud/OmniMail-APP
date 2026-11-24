import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { useTranslation } from "../mail/translation/TranslationContext";
import { mailAiScope } from "./aiPrivacyScope";

export function AiPrivacyBadge() {
  const { lang, isEn, t } = useI18n();
  const { workspace } = useApp();
  const { language, result } = useTranslation();
  const includesSubject = workspace.settings.aiIncludeSenderAndAttachments;
  const scope = mailAiScope(includesSubject, lang);
  const foreign =
    Boolean(result) ||
    (language !== "auto" &&
      (isEn ? language !== "en" : !language.startsWith("zh")));
  const label = foreign
    ? t(
        includesSubject
          ? "ai.foreignScopeSubjectAndBody"
          : "ai.foreignScopeBodyOnly",
      )
    : scope.short;
  const suffix = t("ai.foreignScopeTitleSuffix");
  return (
    <div className="ai-privacy-wrap">
      <button
        type="button"
        className="ai-privacy-pill"
        title={foreign && suffix ? `${label}${suffix}` : label}
        onClick={() => workspace.setOverlay({ type: "settings", tab: "ai" })}
      >
        <span className="row" style={{ gap: 6, minWidth: 0 }}>
          <Icon name="shield" size={13} />
          <span className="truncate">{label}</span>
        </span>
        <Icon name="chevronRight" size={12} />
      </button>
    </div>
  );
}
