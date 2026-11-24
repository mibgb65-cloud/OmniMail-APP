import { useCallback, useId, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { AsyncStateGlyph } from "../../common/AsyncStateGlyph";
import { Icon } from "../../common/Icon";
import { useTranslation } from "./TranslationContext";
import { getLanguageLabel } from "./translationLanguages";
import { TranslationPopover } from "./TranslationPopover";

export function ReaderTranslateButton() {
  const { lang, isEn, t: tr } = useI18n();
  const t = useTranslation();
  const anchor = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const close = useCallback((restoreFocus?: boolean) => {
    setOpen(false);
    if (restoreFocus) toggle.current?.focus({ preventScroll: true });
  }, []);
  const active = t.hasTranslation && t.mode !== "original";
  const target = t.result?.content.target;
  const targetLabel = target
    ? target.startsWith("zh-") && !isEn
      ? tr("translation.translatedZhShort")
      : getLanguageLabel(target, lang)
    : "";
  const label = t.pending
    ? tr("translation.translating")
    : active && t.partial
      ? tr("translation.partialTranslated")
      : active && target && !isEn
        ? tr("translation.translatedLang", { lang: targetLabel })
        : active
          ? tr("translation.translated")
          : tr("translation.translate");

  return (
    <div
      ref={anchor}
      className="reader-translate-button"
      data-active={active}
      aria-busy={t.pending}
    >
      <button
        type="button"
        className="btn btn-secondary reader-act-btn translation-main-action"
        aria-label={label}
        disabled={t.pending}
        title={label}
        onClick={() => {
          if (!t.disabled && t.hasTranslation) {
            t.setMode(active ? "original" : t.preferredMode);
            close();
          } else setOpen(true);
        }}
      >
        {t.pending ? (
          <AsyncStateGlyph status="loading" size={14} />
        ) : (
          <Icon name="language" size={14} />
        )}
        <span>{label}</span>
      </button>
      <button
        type="button"
        ref={toggle}
        className="btn btn-secondary reader-act-btn translation-menu-action"
        aria-label={tr("translation.optionsTitle")}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="chevronDown" size={11} />
      </button>
      {open && (
        <TranslationPopover
          key={t.mailId}
          id={id}
          anchor={anchor}
          onClose={close}
        />
      )}
    </div>
  );
}
