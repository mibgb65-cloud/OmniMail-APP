import { useCallback, useRef } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { LightboxImageItem } from "../../../types/ui";
import {
  ImageLightboxControls,
  LightboxNavButton,
} from "./ImageLightboxControls";
import {
  ImageLightboxErrorCard,
  ImageLightboxTopbar,
  useLightboxKeyboard,
} from "./ImageLightboxTopbar";
import { useLightboxActions } from "./useLightboxActions";
import { useLightboxGalleryState } from "./useLightboxGalleryState";
import { useLightboxViewport } from "./useLightboxViewport";

interface ImageLightboxModalProps {
  images: LightboxImageItem[];
  initialIndex: number;
  closing?: boolean;
}

const HINT_KEYS = {
  light: "imageLightbox.autoHintLight",
  dark: "imageLightbox.autoHintDark",
  checker: "imageLightbox.autoHintChecker",
} as const;

export function ImageLightboxModal({
  images,
  initialIndex,
  closing = false,
}: ImageLightboxModalProps) {
  const { t } = useI18n();
  const { workspace } = useApp();
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const vp = useLightboxViewport(stageRef);
  const gallery = useLightboxGalleryState(
    images,
    initialIndex,
    workspace.settings.theme,
    vp.resetViewport,
  );
  const act = useLightboxActions(gallery.current, imgRef);
  const close = useCallback(
    () => workspace.setOverlay({ type: "none" }),
    [workspace],
  );

  useLightboxKeyboard({
    canNavigate: images.length > 1,
    onClose: close,
    onPrev: () => gallery.goTo(gallery.index - 1),
    onNext: () => gallery.goTo(gallery.index + 1),
    onZoomIn: vp.zoomIn,
    onZoomOut: vp.zoomOut,
    onFit: vp.fitToWindow,
    onRotate: vp.rotateRight,
  });

  const { current, pres } = gallery;
  if (!current) return null;

  const autoHint = pres.autoHintKind ? t(HINT_KEYS[pres.autoHintKind]) : null;
  const { x, y, scale, rotation, fitMode } = vp.transform;
  const imgTransform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotation}deg)`;
  const carrierCls = [
    "lightbox-media-carrier",
    fitMode && "fit",
    vp.canPan && "pannable",
    vp.dragging && "dragging",
    pres.matSurface && "lightbox-media-mat",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("imageLightbox.ariaDialog")}
      data-closing={closing ? "true" : "false"}
      data-canvas-tone={pres.canvasTone}
      data-pure-dark={pres.pureDark ? "true" : "false"}
      onClick={close}
    >
      <ImageLightboxTopbar
        name={current.name}
        subtitle={gallery.subtitle}
        indexPill={
          images.length > 1 ? `${gallery.index + 1} / ${images.length}` : null
        }
        activeSurface={pres.activeChoice}
        onSelectSurface={gallery.setManualSurface}
        onClose={close}
      />

      <div ref={stageRef} className="lightbox-stage" onWheel={vp.handleWheel}>
        {images.length > 1 && (
          <LightboxNavButton
            dir="prev"
            ariaLabel={t("imageLightbox.prevImageAria")}
            onTrigger={() => gallery.goTo(gallery.index - 1)}
          />
        )}

        <div className="lightbox-stage-frame">
          {gallery.isFailed ? (
            <ImageLightboxErrorCard onRetry={gallery.retryCurrent} />
          ) : (
            <div
              key={`${current.id}-${gallery.retryTick}`}
              className="lightbox-slide-swap"
            >
              <div
                className={carrierCls}
                data-mat={pres.matSurface ?? undefined}
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
              >
                <img
                  ref={imgRef}
                  src={gallery.imgSrc}
                  alt={current.name}
                  draggable={false}
                  className="lightbox-canvas-img"
                  onLoad={gallery.handleImgLoad}
                  onError={gallery.markCurrentFailed}
                />
                {autoHint && fitMode && (
                  <span className="lightbox-mat-hint">{autoHint}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {images.length > 1 && (
          <LightboxNavButton
            dir="next"
            ariaLabel={t("imageLightbox.nextImageAria")}
            onTrigger={() => gallery.goTo(gallery.index + 1)}
          />
        )}
      </div>

      <ImageLightboxControls
        images={images}
        activeIndex={gallery.index}
        zoomPct={vp.zoomPct}
        fitMode={fitMode}
        busyCopy={act.busyCopy}
        busySave={act.busySave}
        onZoomOut={vp.zoomOut}
        onZoomIn={vp.zoomIn}
        onFit={vp.fitToWindow}
        onRotate={vp.rotateRight}
        onCopy={act.handleCopy}
        onSave={act.handleSave}
        onSelectIndex={gallery.goTo}
      />
    </div>
  );
}
