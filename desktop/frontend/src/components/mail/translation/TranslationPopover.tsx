import { useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import { Checkbox } from "../../common/Checkbox";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../common/CustomSelect";
import { Icon } from "../../common/Icon";
import { FadeScroll } from "../../common/scroll-fade/FadeScroll";
import { useTranslation } from "./TranslationContext";
import { getLanguages, isLanguage } from "./translationLanguages";
import {
  getTranslationModes,
  type TranslationOptions,
} from "./translationTypes";
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
  const { lang, t: tr } = useI18n();
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

  const languageMap = getLanguages(lang);
  const targetLanguageOptions: CustomSelectOption[] = Object.entries(
    languageMap,
  ).map(([value, label]) => ({ value, label }));
  const sourceOptions: CustomSelectOption[] = [
    {
      value: "auto",
      label:
        t.language !== "auto"
          ? tr("translation.autoDetectDetected", {
              lang: languageMap[t.language],
            })
          : tr("translation.autoDetect"),
    },
    ...targetLanguageOptions,
  ];
  const modes = getTranslationModes(tr);
  const optionsTitle = tr("translation.optionsTitle");
  const sourceLabel = tr("translation.sourceLanguage");
  const targetLabel = tr("translation.targetLanguage");

  return createPortal(
    <div
      id={id}
      role="dialog"
      aria-labelledby={heading}
      className="translation-popover"
      ref={panel}
    >
      <FadeScroll className="translation-options" label={optionsTitle}>
        <header className="row-between">
          <strong id={heading}>{optionsTitle}</strong>
          <span className="pill translation-badge">
            <Icon name="language" size={14} />
            {tr("translation.translate")}
          </span>
        </header>
        <div className="translation-language-row">
          <div className="translation-language-field">
            <span className="translation-language-label">{sourceLabel}</span>
            <CustomSelect
              compact
              fullWidth
              minMenuWidth={168}
              ariaLabel={sourceLabel}
              value={options.source}
              options={sourceOptions}
              onChange={(value) => {
                if (value === "auto" || isLanguage(value))
                  update("source", value);
              }}
            />
          </div>
          <Icon name="arrowRight" size={15} />
          <div className="translation-language-field">
            <span className="translation-language-label">{targetLabel}</span>
            <CustomSelect
              compact
              fullWidth
              minMenuWidth={168}
              ariaLabel={targetLabel}
              value={options.target}
              options={targetLanguageOptions}
              onChange={(value) => {
                if (isLanguage(value)) update("target", value);
              }}
            />
          </div>
        </div>
        <fieldset className="translation-mode-options">
          <legend>{tr("translation.displayMode")}</legend>
          {modes.map(({ id: mode, option }) => (
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
        <Checkbox
          checked={options.includeSubject}
          size="sm"
          ariaLabel={tr("translation.translateSubject")}
          onChange={(checked) => update("includeSubject", checked)}
        >
          {tr("translation.translateSubject")}
        </Checkbox>
        <p className="text-xs text-muted">
          {t.disabled
            ? t.disabledReason || tr("translation.openMailFirstHint")
            : options.source === options.target
              ? tr("translation.pickDiffTargetHint")
              : tr("translation.privacyHint")}
        </p>
        <span className="text-xs text-muted">
          {tr("translation.enginePrefix", { engine: t.engineLabel })}
        </span>
        <footer className="row-between">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onClose();
              workspace.setOverlay({ type: "settings", tab: "translation" });
            }}
          >
            {tr("translation.translationSettings")}
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
            {t.pending
              ? tr("translation.translating")
              : tr("translation.startTranslate")}
          </button>
        </footer>
      </FadeScroll>
    </div>,
    document.body,
  );
}
