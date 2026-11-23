import { useCallback, useId, useRef, useState } from "react";
import { AsyncStateGlyph } from "../../common/AsyncStateGlyph";
import { Icon } from "../../common/Icon";
import { useTranslation } from "./TranslationContext";
import { languages } from "./translationLanguages";
import { TranslationPopover } from "./TranslationPopover";

export function ReaderTranslateButton() {
  const t = useTranslation();
  const anchor = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const close = useCallback((restoreFocus?: boolean) => {
    setOpen(false);
    if (restoreFocus) toggle.current?.focus({ preventScroll: true });
  }, []);
  const active = Boolean(t.result && t.mode !== "original");
  const lang = t.result?.content.target;
  const label = t.pending
    ? "翻译中…"
    : active && lang
      ? `已译${lang.startsWith("zh-") ? "中文" : languages[lang]}`
      : "翻译";

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
          if (t.result) {
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
        aria-label="翻译选项"
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="chevronDown" size={11} />
      </button>
      {open && <TranslationPopover id={id} anchor={anchor} onClose={close} />}
    </div>
  );
}
