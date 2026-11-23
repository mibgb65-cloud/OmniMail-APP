import { useApp } from "../../state/AppContext";
import { useTranslation } from "../mail/translation/TranslationContext";
import {
  isLanguage,
  languages,
} from "../mail/translation/translationLanguages";
import { SwitchRow } from "./SwitchRow";

export function TranslationSettingsTab({ onOpenAi }: { onOpenAi: () => void }) {
  const { workspace } = useApp();
  const { preferences, savePreferences } = useTranslation();
  return (
    <div className="settings-card">
      <strong>邮件翻译</strong>
      <div className="settings-row">
        <div>
          <strong>翻译引擎</strong>
          <p className="text-xs text-muted">
            使用 AI 助手中配置的模型
            {workspace.settings.aiModel
              ? `（${workspace.settings.aiModel}）`
              : ""}
            。只在你点击「开始翻译」后发送文字。
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onOpenAi}
        >
          配置模型
        </button>
      </div>
      <label className="settings-row">
        默认目标语言
        <select
          className="input"
          value={preferences.target}
          onChange={(e) => {
            if (isLanguage(e.target.value))
              savePreferences({ ...preferences, target: e.target.value });
          }}
        >
          {Object.entries(languages).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-row">
        默认显示模式
        <select
          className="input"
          value={preferences.mode}
          onChange={(e) =>
            savePreferences({
              ...preferences,
              mode: e.target.value === "bilingual" ? "bilingual" : "translated",
            })
          }
        >
          <option value="translated">仅译文</option>
          <option value="bilingual">双语对照</option>
        </select>
      </label>
      <SwitchRow
        heading="默认同步翻译主题"
        desc="关闭时只翻译正文。可在邮件顶部翻译选项中按封调整。"
        checked={preferences.includeSubject}
        onChange={(includeSubject) =>
          savePreferences({ ...preferences, includeSubject })
        }
      />
    </div>
  );
}
