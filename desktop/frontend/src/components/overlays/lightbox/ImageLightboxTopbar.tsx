import { useEffect } from "react";
import { useI18n } from "../../../i18n";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";
import type { LightboxSurfaceChoice } from "./imageSurfaceAnalysis";

interface ImageLightboxTopbarProps {
  name: string;
  subtitle: string;
  indexPill: string | null;
  activeSurface: LightboxSurfaceChoice;
  onSelectSurface: (choice: LightboxSurfaceChoice) => void;
  onClose: () => void;
}

const SURFACE_OPTIONS: readonly LightboxSurfaceChoice[] = [
  "checker",
  "light",
  "dark",
];

export function ImageLightboxTopbar({
  name,
  subtitle,
  indexPill,
  activeSurface,
  onSelectSurface,
  onClose,
}: ImageLightboxTopbarProps) {
  const { t } = useI18n();
  const labelFor = (choice: LightboxSurfaceChoice) => {
    if (choice === "checker") return t("imageLightbox.surfaceChecker");
    if (choice === "light") return t("imageLightbox.surfaceLight");
    return t("imageLightbox.surfaceDark");
  };

  return (
    <header className="lightbox-topbar">
      <div
        className="lightbox-info-capsule"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="lightbox-title-icon">
          <Icon name="image" size={15} />
        </span>
        <div className="lightbox-title-meta">
          <div className="lightbox-filename truncate">{name}</div>
          {subtitle && (
            <div className="lightbox-source truncate">{subtitle}</div>
          )}
        </div>
        {indexPill && (
          <>
            <span className="lightbox-capsule-sep" aria-hidden="true" />
            <span className="lightbox-index-pill">{indexPill}</span>
          </>
        )}
      </div>

      <div
        className="lightbox-top-actions"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="lightbox-surface-switcher"
          role="group"
          aria-label={t("imageLightbox.surfaceGroupAria")}
        >
          {SURFACE_OPTIONS.map((choice) => {
            const active = activeSurface === choice;
            return (
              <button
                key={choice}
                type="button"
                className={`lightbox-surface-btn${active ? " active" : ""}`}
                aria-pressed={active}
                onClick={() => onSelectSurface(choice)}
              >
                <span
                  className={`lightbox-swatch ${choice}`}
                  aria-hidden="true"
                />
                <span>{labelFor(choice)}</span>
              </button>
            );
          })}
        </div>

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
      <button type="button" className="lightbox-retry-btn" onClick={onRetry}>
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
