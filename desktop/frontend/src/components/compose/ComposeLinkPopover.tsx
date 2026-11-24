import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import { normalizeComposeHref } from "./composeRichHtml";

interface ComposeLinkPopoverProps {
  initialText: string;
  onConfirm: (url: string, displayText: string) => void;
  onClose: () => void;
}

export function ComposeLinkPopover({
  initialText,
  onConfirm,
  onClose,
}: ComposeLinkPopoverProps) {
  const { t } = useI18n();
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeComposeHref(url);
    if (!normalized) {
      setError(t("compose.linkInvalidUrl"));
      return;
    }
    onConfirm(normalized, text.trim() || normalized);
  };

  return (
    <div
      ref={popoverRef}
      className="compose-link-popover"
      role="dialog"
      aria-label={t("compose.linkPopoverTitle")}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="compose-link-popover-head">
        <span>{t("compose.linkPopoverTitle")}</span>
        <button
          type="button"
          className="icon-btn"
          style={{ width: 22, height: 22 }}
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
      <form className="compose-link-popover-body" onSubmit={handleSubmit}>
        <label className="compose-link-field">
          <span>{t("compose.linkTextLabel")}</span>
          <input
            type="text"
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("compose.linkTextPlaceholder")}
          />
        </label>
        <label className="compose-link-field">
          <span>{t("compose.linkUrlLabel")}</span>
          <input
            ref={urlInputRef}
            type="text"
            className="input"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError("");
            }}
            placeholder={t("compose.linkUrlPlaceholder")}
          />
        </label>
        {error && <div className="compose-link-error">{error}</div>}
        <div className="compose-link-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            {t("compose.linkConfirmBtn")}
          </button>
        </div>
      </form>
    </div>
  );
}
