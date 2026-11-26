import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import {
  computeUpdatePopoverLayout,
  extractReleaseHighlights,
  formatByteSize,
  formatVersionTag,
  type UpdatePopoverLayout,
} from "../../utils/updateFormat";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { TopBarUpdatePopoverActions } from "./TopBarUpdatePopoverActions";

export function TopBarUpdatePopover({
  open,
  anchorRef,
  isCompact,
  onClose,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  isCompact: boolean;
  onClose: () => void;
}) {
  const { updateStore } = useApp();
  const { t } = useI18n();
  const popRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<UpdatePopoverLayout>({
    top: 52,
    left: 24,
    width: 396,
    notesMaxHeight: 220,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const syncPosition = () => {
      const el = anchorRef.current;
      if (!el) return;
      setLayout(
        computeUpdatePopoverLayout(
          el.getBoundingClientRect(),
          window.innerWidth,
          window.innerHeight,
          isCompact,
        ),
      );
    };
    syncPosition();
    window.addEventListener("resize", syncPosition);
    return () => window.removeEventListener("resize", syncPosition);
  }, [anchorRef, isCompact, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const node = e.target as Node | null;
      if (
        !anchorRef.current?.contains(node) &&
        !popRef.current?.contains(node)
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
      anchorRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const { buildInfo, checkResult, progress } = updateStore;
  const latestVer = formatVersionTag(
    progress?.version || checkResult?.latestVersion || buildInfo.version,
  );
  const currentVer = formatVersionTag(buildInfo.version);
  const sizeText = formatByteSize(
    progress?.totalBytes || checkResult?.assetSize || 0,
  );
  const highlights = extractReleaseHighlights(
    checkResult?.releaseNotes ?? "",
    5,
  );

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label={t("updater.popHeading")}
      className="topbar-update-popover"
      style={{ top: layout.top, left: layout.left, width: layout.width }}
    >
      <div className="tup-head">
        <div className="tup-title-row">
          <span className="tup-heading">{t("updater.popHeading")}</span>
          <span className="tup-ver-badge">{latestVer}</span>
        </div>
        <div className="tup-meta-strip">
          <span>
            {t("updater.popCurrentLabel")} {currentVer}
          </span>
          <span className="tup-dot">·</span>
          <span>
            {t("updater.popSizeLabel")} {sizeText}
          </span>
          <span className="tup-dot">·</span>
          <span className="tup-verify-tag">{t("updater.popVerifyValue")}</span>
        </div>
      </div>

      <div className="tup-section-label">{t("updater.popHighlightsTitle")}</div>
      <FadeScroll
        className="tup-notes-scroll"
        style={{ maxHeight: layout.notesMaxHeight }}
      >
        <ul className="tup-highlights-list">
          {(highlights.length > 0
            ? highlights
            : [t("updater.popHighlightsFallback")]
          ).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </FadeScroll>

      <TopBarUpdatePopoverActions latestVer={latestVer} onClose={onClose} />
    </div>,
    document.body,
  );
}
