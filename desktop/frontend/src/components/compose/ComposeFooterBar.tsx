import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

interface ComposeModalHeaderProps {
  modeTitle: string;
  savedAtText: string;
  aiBusy?: boolean;
  onMinimize: () => void;
}

export function ComposeModalHeader({
  modeTitle,
  savedAtText,
  aiBusy = false,
  onMinimize,
}: ComposeModalHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="modal-header compose-modal-header">
      <div className="row" style={{ gap: 8, minWidth: 0 }}>
        <h2 className="modal-title truncate">{modeTitle}</h2>
        {aiBusy && (
          <span className="cia-header-drafting-pill">
            <i className="cia-dot-pulse" aria-hidden="true" />
            <span>{t("compose.aiDraftingHeaderPill")}</span>
          </span>
        )}
        <span className="pill pill-neutral truncate">{savedAtText}</span>
      </div>
      <div className="row" style={{ gap: 6, flexShrink: 0 }}>
        <Tooltip label={t("compose.minimizeTip")}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onMinimize}
          >
            <Icon name="minus" size={14} /> {t("compose.minimizeBtn")}
          </button>
        </Tooltip>
        <Tooltip label={t("compose.closeKeepDraftTip")} shortcut="Esc">
          <button
            type="button"
            className="icon-btn icon-btn-bordered"
            style={{ width: 28, height: 28 }}
            aria-label={t("compose.closeComposeAria")}
            onClick={onMinimize}
          >
            <Icon name="x" size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

interface ComposeFooterBarProps {
  scheduledAt?: string;
  isCompact: boolean;
  aiBusy?: boolean;
  onSend: () => void;
  onSchedule: () => void;
  onDiscard: () => void;
}

export function ComposeFooterBar({
  scheduledAt,
  isCompact,
  aiBusy = false,
  onSend,
  onSchedule,
  onDiscard,
}: ComposeFooterBarProps) {
  const { t } = useI18n();
  return (
    <div className="modal-footer compose-footer-fixed">
      <div className="row" style={{ gap: 8, minWidth: 0 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={aiBusy}
          onClick={onSend}
        >
          <span>
            {scheduledAt
              ? t("compose.confirmScheduleSend")
              : t("compose.sendBtn")}
          </span>
          <Icon name="send" size={13} />
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={aiBusy}
          onClick={onSchedule}
        >
          <Icon name="clock" size={13} /> {t("compose.scheduleSendBtn")}
        </button>
        {aiBusy && !isCompact && (
          <span className="cia-footer-lock-hint truncate">
            {t("compose.footerSendLockedHint")}
          </span>
        )}
      </div>

      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
        <span className={`kbd${aiBusy ? " is-muted" : ""}`}>Ctrl + Enter</span>
        {!isCompact && !aiBusy && (
          <span className="text-xs text-muted">
            {t("compose.quickSendHint")}
          </span>
        )}
        <Tooltip label={t("compose.deleteDraftTip")} placement="top">
          <button
            type="button"
            className="icon-btn icon-btn-bordered"
            style={{ width: 32, height: 32, color: "var(--status-danger)" }}
            aria-label={t("compose.deleteDraftTip")}
            onClick={onDiscard}
          >
            <Icon name="trash" size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
