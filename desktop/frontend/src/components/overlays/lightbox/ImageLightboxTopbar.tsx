import { useEffect } from "react";
import { useI18n } from "../../../i18n";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";

interface ImageLightboxTopbarProps {
  name: string;
  sourceLabel?: string;
  metaPill: string;
  busySave: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function ImageLightboxTopbar({
  name,
  sourceLabel,
  metaPill,
  busySave,
  onSave,
  onClose,
}: ImageLightboxTopbarProps) {
  const { t } = useI18n();
  return (
    <header
      className="lightbox-topbar"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="lightbox-title-group">
        <span className="lightbox-title-icon">
          <Icon name="image" size={16} />
        </span>
        <div className="lightbox-title-meta">
          <div className="lightbox-filename truncate">{name}</div>
          {sourceLabel && (
            <div className="lightbox-source truncate">{sourceLabel}</div>
          )}
        </div>
        <span className="lightbox-meta-pill">{metaPill}</span>
      </div>

      <div className="lightbox-top-actions">
        <button
          type="button"
          className="lightbox-top-btn"
          disabled={busySave}
          onClick={onSave}
        >
          <Icon name="download" size={14} />
          <span>{t("imageLightbox.saveAsBtn")}</span>
        </button>
        <Tooltip
          label={t("imageLightbox.closeAria")}
          shortcut="Esc"
          placement="bottom"
        >
          <button
            type="button"
            className="lightbox-close-btn"
            aria-label={t("imageLightbox.closeAria")}
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </Tooltip>
      </div>
    </header>
  );
}

export function ImageLightboxErrorCard({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="lightbox-error-card" onClick={(e) => e.stopPropagation()}>
      <Icon name="alertCircle" size={28} />
      <div className="lightbox-error-title">
        {t("imageLightbox.loadFailedTitle")}
      </div>
      <div className="lightbox-error-detail">
        {t("imageLightbox.loadFailedDetail")}
      </div>
      <button type="button" className="lightbox-top-btn" onClick={onRetry}>
        <Icon name="refresh" size={14} />
        <span>{t("imageLightbox.inlineImageRetryBtn")}</span>
      </button>
    </div>
  );
}

export function useLightboxKeyboard(handlers: {
  canNavigate: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRotate: () => void;
}) {
  const {
    canNavigate,
    onClose,
    onPrev,
    onNext,
    onZoomIn,
    onZoomOut,
    onFit,
    onRotate,
  } = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft" && canNavigate) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && canNavigate) {
        e.preventDefault();
        onNext();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        onZoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        onZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        onFit();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        onRotate();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    canNavigate,
    onClose,
    onFit,
    onNext,
    onPrev,
    onRotate,
    onZoomIn,
    onZoomOut,
  ]);
}
