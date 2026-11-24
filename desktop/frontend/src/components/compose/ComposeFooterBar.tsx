import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

interface ComposeModalHeaderProps {
  modeTitle: string;
  savedAtText: string;
  onMinimize: () => void;
}

export function ComposeModalHeader({
  modeTitle,
  savedAtText,
  onMinimize,
}: ComposeModalHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="modal-header compose-modal-header">
      <div className="row" style={{ gap: 8, minWidth: 0 }}>
        <h2 className="modal-title truncate">{modeTitle}</h2>
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
  onSend: () => void;
  onSchedule: () => void;
  onDiscard: () => void;
}

export function ComposeFooterBar({
  scheduledAt,
  isCompact,
  onSend,
  onSchedule,
  onDiscard,
}: ComposeFooterBarProps) {
  const { t } = useI18n();
  return (
    <div className="modal-footer compose-footer-fixed">
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={onSend}>
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
          onClick={onSchedule}
        >
          <Icon name="clock" size={13} /> {t("compose.scheduleSendBtn")}
        </button>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <span className="kbd">Ctrl + Enter</span>
        {!isCompact && (
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
