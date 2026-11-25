import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import { deriveAccountSyncState } from "../../state/accountSyncState";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { SyncIssueAccountCard } from "./SyncIssueAccountCard";

export interface SyncStatusPopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function SyncStatusPopover({
  open,
  anchorRef,
  onClose,
}: SyncStatusPopoverProps) {
  const { workspace, triggerSyncAll } = useApp();
  const { lang, t, formatTime, localizeText } = useI18n();
  const popRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState({ top: 64, left: 16, width: 486 });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(486, Math.max(320, window.innerWidth - 24));
      const left = Math.max(
        12,
        Math.min(r.left, window.innerWidth - width - 12),
      );
      setCoords({
        top: Math.round(r.bottom + 8),
        left: Math.round(left),
        width,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const tNode = e.target as Node | null;
      if (
        !anchorRef.current?.contains(tNode) &&
        !popRef.current?.contains(tNode)
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
  }, [open, anchorRef, onClose]);

  if (!open || typeof document === "undefined") return null;

  const { issueAccounts, healthyAccounts, authExpiredAccounts } =
    deriveAccountSyncState(workspace.accounts);
  const issueCount = issueAccounts.length;
  const badgeTone =
    authExpiredAccounts.length > 0
      ? "danger"
      : issueCount > 0
        ? "warning"
        : "healthy";
  const sampleNames = healthyAccounts
    .slice(0, 3)
    .map((a) => localizeText(a.providerLabel || a.name))
    .filter(Boolean)
    .join(lang === "en-US" ? ", " : "、");

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label={t("topbar.popTitle")}
      className="sync-status-popover"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      <div className="ssp-head">
        <div className="ssp-head-left">
          <div className="ssp-title-row">
            <span className="ssp-title">{t("topbar.popTitle")}</span>
            <span className="ssp-badge" data-tone={badgeTone}>
              {issueCount > 0
                ? t("topbar.popIssueBadge", { count: issueCount })
                : t("topbar.popHealthyBadge")}
            </span>
          </div>
          <span className="ssp-subtitle">{t("topbar.popSubtitle")}</span>
        </div>
        <button
          type="button"
          className="ssp-retry-all-btn"
          onClick={() => triggerSyncAll()}
        >
          {issueCount > 0 ? t("topbar.popRetryAll") : t("topbar.popSyncAll")}
        </button>
      </div>

      {issueCount > 0 ? (
        <FadeScroll className="ssp-card-list" style={{ maxHeight: 332 }}>
          {issueAccounts.map((acc) => (
            <SyncIssueAccountCard
              key={acc.id}
              account={acc}
              onClosePopover={onClose}
            />
          ))}
        </FadeScroll>
      ) : (
        <div className="ssp-all-healthy-card">
          <div className="ssp-healthy-title-row">
            <Icon name="checkCircle" size={16} />
            <strong>{t("topbar.popAllHealthyTitle")}</strong>
          </div>
          <p className="ssp-healthy-desc">
            {t("topbar.popAllHealthySub", { count: workspace.accounts.length })}
          </p>
        </div>
      )}

      {issueCount > 0 && healthyAccounts.length > 0 && (
        <div className="ssp-healthy-summary">
          <span className="ssp-healthy-left truncate">
            <span className="ssp-healthy-dot" aria-hidden="true" />
            <span className="truncate">
              {sampleNames
                ? t("topbar.popHealthyOthersWithSample", {
                    count: healthyAccounts.length,
                    sample: sampleNames,
                  })
                : t("topbar.popHealthyOthers", {
                    count: healthyAccounts.length,
                  })}
            </span>
          </span>
          <span className="ssp-healthy-time">
            {formatTime(healthyAccounts[0].lastSyncedAt)}
          </span>
        </div>
      )}
    </div>,
    document.body,
  );
}
