import { useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../../state/AppContext";
import { Icon } from "../../common/Icon";
import { FadeScroll } from "../../common/scroll-fade/FadeScroll";
import { useTranslation } from "./TranslationContext";
import { isLanguage, languages } from "./translationLanguages";
import { translationModes, type TranslationOptions } from "./translationTypes";
import { useTranslationAnchor } from "./useTranslationAnchor";

export function TranslationPopover({
  id,
  anchor,
  onClose,
}: {
  id: string;
  anchor: RefObject<HTMLDivElement | null>;
  onClose: (restoreFocus?: boolean) => void;
}) {
  const t = useTranslation();
  const { workspace } = useApp();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useId();
  const [options, setOptions] = useState<TranslationOptions>(
    () => t.result?.options ?? { source: "auto", ...t.preferences },
  );
  const canTranslate =
    !t.disabled && options.source !== options.target && !t.pending;

  useTranslationAnchor(panel, anchor, onClose);

  const update = <K extends keyof TranslationOptions>(
    key: K,
    value: TranslationOptions[K],
  ) => setOptions((prev) => ({ ...prev, [key]: value }));

  return createPortal(
    <div
      id={id}
      role="dialog"
      aria-labelledby={heading}
      className="translation-popover"
      ref={panel}
    >
      <FadeScroll className="translation-options" label="翻译选项">
        <header className="row-between">
          <strong id={heading}>翻译选项</strong>
          <span className="pill translation-badge">
            <Icon name="language" size={14} />
            翻译
          </span>
        </header>
        <div className="translation-language-row">
          <label>
            源语言
            <select
              className="input"
              value={options.source}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "auto" || isLanguage(value))
                  update("source", value);
              }}
            >
              <option value="auto">
                自动检测
                {t.language !== "auto" ? `（${languages[t.language]}）` : ""}
              </option>
              {Object.entries(languages).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Icon name="arrowRight" size={15} />
          <label>
            目标语言
            <select
              className="input"
              value={options.target}
              onChange={(e) => {
                if (isLanguage(e.target.value))
                  update("target", e.target.value);
              }}
            >
              {Object.entries(languages).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="translation-mode-options">
          <legend>显示模式</legend>
          {translationModes.map(({ id: mode, option }) => (
            <button
              type="button"
              key={mode}
              className="btn btn-secondary"
              disabled={mode === "original" && !t.result}
              aria-pressed={
                t.result && t.mode === "original"
                  ? mode === "original"
                  : options.mode === mode
              }
              onClick={() => {
                if (mode === "original") {
                  t.setMode(mode);
                  onClose(true);
                } else {
                  update("mode", mode);
                  const existing = t.result?.options;
                  if (
                    existing?.source === options.source &&
                    existing.target === options.target &&
                    existing.includeSubject === options.includeSubject
                  )
                    t.setMode(mode);
                }
              }}
            >
              {option}
            </button>
          ))}
        </fieldset>
        <label className="row translation-subject-option">
          <input
            type="checkbox"
            checked={options.includeSubject}
            onChange={(e) => update("includeSubject", e.target.checked)}
          />
          同步翻译主题
        </label>
        <p className="text-xs text-muted">
          {t.disabled
            ? "此邮件不可翻译，或尚未启用翻译所需的模型。"
            : options.source === options.target
              ? "请选择与源语言不同的目标语言。"
              : "开始后会向翻译引擎发送正文文字及所选主题，不发送邮件头、图片或附件。"}
        </p>
        <footer className="row-between">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onClose();
              workspace.setOverlay({ type: "settings", tab: "translation" });
            }}
          >
            翻译设置
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canTranslate}
            onClick={() => {
              void t.translate(options);
              onClose(true);
            }}
          >
            {t.pending ? "翻译中…" : "开始翻译"}
          </button>
        </footer>
      </FadeScroll>
    </div>,
    document.body,
  );
}
