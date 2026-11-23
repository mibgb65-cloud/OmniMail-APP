import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { useTranslation } from "../mail/translation/TranslationContext";
import { mailAiScope } from "./aiPrivacyScope";

export function AiPrivacyBadge() {
  const { workspace } = useApp();
  const { language, result } = useTranslation();
  const includesSubject = workspace.settings.aiIncludeSenderAndAttachments;
  const scope = mailAiScope(includesSubject);
  const ui = workspace.settings.language === "en-US" ? "en" : "zh-CN";
  const foreign = Boolean(result) || (language !== "auto" && language !== ui);
  const label = foreign
    ? `基于原文分析 · ${includesSubject ? "正文与主题" : "仅当前正文"}`
    : scope.short;
  return (
    <div className="ai-privacy-wrap">
      <button
        type="button"
        className="ai-privacy-pill"
        title={foreign ? `${label} · 附件不外传` : label}
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
