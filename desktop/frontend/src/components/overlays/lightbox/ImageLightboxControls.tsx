import { useEffect, useRef } from "react";
import { useI18n } from "../../../i18n";
import type { LightboxImageItem } from "../../../types/ui";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";

interface ImageLightboxControlsProps {
  images: LightboxImageItem[];
  activeIndex: number;
  zoomPct: number;
  fitMode: boolean;
  busyCopy: boolean;
  busySave: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  onRotate: () => void;
  onCopy: () => void;
  onSave: () => void;
  onSelectIndex: (index: number) => void;
}

export function ImageLightboxControls({
  images,
  activeIndex,
  zoomPct,
  fitMode,
  busyCopy,
  busySave,
  onZoomOut,
  onZoomIn,
  onFit,
  onRotate,
  onCopy,
  onSave,
  onSelectIndex,
}: ImageLightboxControlsProps) {
  const { t } = useI18n();
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeIndex]);

  return (
    <div
      className="lightbox-bottom-dock"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="lightbox-control-capsule" role="toolbar">
        <Tooltip
          label={t("imageLightbox.zoomOutTip")}
          shortcut="-"
          placement="top"
        >
          <button
            type="button"
            className="lightbox-ctrl-btn"
            aria-label={t("imageLightbox.zoomOutTip")}
            onClick={onZoomOut}
          >
            <Icon name="minus" size={14} />
          </button>
        </Tooltip>

        <span className="lightbox-zoom-pct">{zoomPct}%</span>

        <Tooltip
          label={t("imageLightbox.zoomInTip")}
          shortcut="+"
          placement="top"
        >
          <button
            type="button"
            className="lightbox-ctrl-btn"
            aria-label={t("imageLightbox.zoomInTip")}
            onClick={onZoomIn}
          >
            <Icon name="plus" size={14} />
          </button>
        </Tooltip>

        <span className="lightbox-ctrl-sep" aria-hidden="true" />

        <Tooltip
          label={t("imageLightbox.fitWindowTip")}
          shortcut="0"
          placement="top"
        >
          <button
            type="button"
            className={`lightbox-ctrl-text-btn${fitMode ? " active" : ""}`}
            onClick={onFit}
          >
            {t("imageLightbox.fitWindowTip")}
          </button>
        </Tooltip>

        <Tooltip
          label={t("imageLightbox.rotateRightTip")}
          shortcut="R"
          placement="top"
        >
          <button
            type="button"
            className="lightbox-ctrl-btn"
            aria-label={t("imageLightbox.rotateRightTip")}
            onClick={onRotate}
          >
            <Icon name="refresh" size={14} />
          </button>
        </Tooltip>

        <span className="lightbox-ctrl-sep" aria-hidden="true" />

        <button
          type="button"
          className="lightbox-ctrl-text-btn"
          disabled={busyCopy}
          onClick={onCopy}
        >
          <Icon name="copy" size={13} />
          <span>{t("imageLightbox.copyImageBtn")}</span>
        </button>

        <button
          type="button"
          className="lightbox-ctrl-text-btn primary"
          disabled={busySave}
          onClick={onSave}
        >
          <Icon name="download" size={13} />
          <span>{t("imageLightbox.saveOriginalBtn")}</span>
        </button>
      </div>

      {images.length > 1 && (
        <div className="lightbox-thumb-strip" role="tablist">
          {images.map((item, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={item.id}
                ref={active ? activeThumbRef : null}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={t("imageLightbox.thumbItemAria", {
                  index: idx + 1,
                  name: item.name,
                })}
                className={`lightbox-thumb-item${active ? " active" : ""}`}
                onClick={() => onSelectIndex(idx)}
              >
                <img src={item.src} alt={item.name} draggable={false} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
