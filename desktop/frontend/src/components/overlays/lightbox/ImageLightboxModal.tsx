import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { LightboxImageItem } from "../../../types/ui";
import { Icon } from "../../common/Icon";
import { ImageLightboxControls } from "./ImageLightboxControls";
import {
  ImageLightboxErrorCard,
  ImageLightboxTopbar,
  useLightboxKeyboard,
} from "./ImageLightboxTopbar";
import { useLightboxActions } from "./useLightboxActions";
import { useLightboxViewport } from "./useLightboxViewport";

interface ImageLightboxModalProps {
  images: LightboxImageItem[];
  initialIndex: number;
}

export function ImageLightboxModal({
  images,
  initialIndex,
}: ImageLightboxModalProps) {
  const { t } = useI18n();
  const { workspace } = useApp();
  const safeInit = Math.min(
    Math.max(0, initialIndex),
    Math.max(0, images.length - 1),
  );
  const [index, setIndex] = useState(safeInit);
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>(
    {},
  );
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [retryTick, setRetryTick] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const vp = useLightboxViewport(stageRef);

  const current = images[index];
  const { busyCopy, busySave, handleCopy, handleSave } = useLightboxActions(
    current,
    imgRef,
  );
  const close = useCallback(
    () => workspace.setOverlay({ type: "none" }),
    [workspace],
  );

  const goTo = useCallback(
    (next: number) => {
      if (images.length === 0) return;
      const wrapped = ((next % images.length) + images.length) % images.length;
      setIndex(wrapped);
      vp.resetViewport();
    },
    [images.length, vp],
  );

  useLightboxKeyboard({
    canNavigate: images.length > 1,
    onClose: close,
    onPrev: () => goTo(index - 1),
    onNext: () => goTo(index + 1),
    onZoomIn: vp.zoomIn,
    onZoomOut: vp.zoomOut,
    onFit: vp.fitToWindow,
    onRotate: vp.rotateRight,
  });

  if (!current) return null;

  const dim =
    dims[current.id] ??
    (current.width && current.height
      ? { w: current.width, h: current.height }
      : null);
  const metaPill = dim
    ? `${dim.w} × ${dim.h} · ${index + 1} / ${images.length}`
    : `${index + 1} / ${images.length}`;
  const isFailed = Boolean(failedIds[current.id]);
  const imgSrc =
    retryTick > 0 && !current.src.startsWith("data:")
      ? `${current.src}${current.src.includes("?") ? "&" : "?"}lb=${retryTick}`
      : current.src;
  const { x, y, scale, rotation, fitMode } = vp.transform;
  const imgTransform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotation}deg)`;

  return (
    <div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("imageLightbox.ariaDialog")}
      onClick={close}
    >
      <ImageLightboxTopbar
        name={current.name}
        sourceLabel={current.sourceLabel}
        metaPill={metaPill}
        busySave={busySave}
        onSave={handleSave}
        onClose={close}
      />

      <div ref={stageRef} className="lightbox-stage" onWheel={vp.handleWheel}>
        {images.length > 1 && (
          <button
            type="button"
            className="lightbox-nav-btn prev"
            aria-label={t("imageLightbox.prevImageAria")}
            onClick={(e) => {
              e.stopPropagation();
              goTo(index - 1);
            }}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
        )}

        {isFailed ? (
          <ImageLightboxErrorCard
            onRetry={() => {
              setFailedIds((prev) => ({ ...prev, [current.id]: false }));
              setRetryTick((n) => n + 1);
            }}
          />
        ) : (
          <img
            key={`${current.id}-${retryTick}`}
            ref={imgRef}
            src={imgSrc}
            alt={current.name}
            draggable={false}
            className={`lightbox-canvas-img${fitMode ? " fit" : ""}${vp.canPan ? " pannable" : ""}${vp.dragging ? " dragging" : ""}`}
            style={{ transform: imgTransform }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              vp.toggleFitOrActual();
            }}
            onPointerDown={vp.handlePointerDown}
            onPointerMove={vp.handlePointerMove}
            onPointerUp={vp.handlePointerUp}
            onPointerCancel={vp.handlePointerUp}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                setDims((prev) => ({
                  ...prev,
                  [current.id]: { w: el.naturalWidth, h: el.naturalHeight },
                }));
              }
            }}
            onError={() =>
              setFailedIds((prev) => ({ ...prev, [current.id]: true }))
            }
          />
        )}

        {images.length > 1 && (
          <button
            type="button"
            className="lightbox-nav-btn next"
            aria-label={t("imageLightbox.nextImageAria")}
            onClick={(e) => {
              e.stopPropagation();
              goTo(index + 1);
            }}
          >
            <Icon name="chevronRight" size={22} />
          </button>
        )}
      </div>

      <ImageLightboxControls
        images={images}
        activeIndex={index}
        zoomPct={vp.zoomPct}
        fitMode={fitMode}
        busyCopy={busyCopy}
        busySave={busySave}
        onZoomOut={vp.zoomOut}
        onZoomIn={vp.zoomIn}
        onFit={vp.fitToWindow}
        onRotate={vp.rotateRight}
        onCopy={handleCopy}
        onSave={handleSave}
        onSelectIndex={goTo}
      />
    </div>
  );
}
