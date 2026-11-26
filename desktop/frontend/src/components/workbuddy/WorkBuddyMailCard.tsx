import { useI18n } from "../../i18n";
import type {
  WorkBuddyDirection,
  WorkBuddyMessageSummary,
} from "../../types/workbuddy";
import {
  formatAgentMailTime,
  parseMailAddressDisplay,
} from "../../utils/agentMailFormat";
import { Icon } from "../common/Icon";

export function WorkBuddyMailCard({
  item,
  dir,
  compact,
  selected,
  detailBodyFormat,
  onSelect,
}: {
  item: WorkBuddyMessageSummary;
  dir: WorkBuddyDirection;
  compact: boolean;
  selected: boolean;
  detailBodyFormat?: "HTML" | "TEXT";
  onSelect: () => void;
}) {
  const { lang, t } = useI18n();
  const rawPeer =
    dir === "sent" ? item.to[0] || item.from : item.from || item.to[0] || "";
  const parsedPeer = parseMailAddressDisplay(rawPeer);
  const peerBase = parsedPeer.name || parsedPeer.email || "—";
  const peerDisplay =
    dir === "sent" && item.to.length > 1
      ? `${peerBase} +${item.to.length - 1}`
      : peerBase;

  const rightStatus =
    selected && detailBodyFormat === "HTML"
      ? "HTML"
      : item.isRead
        ? t("workbuddy.alreadyReadLabel")
        : "";

  return (
    <button
      type="button"
      className={`mail-card wb-msg-card ${selected ? "selected" : ""} ${item.isRead ? "read" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="mail-card-top">
        <div className="mail-card-sender">
          {!item.isRead && (
            <span
              className="unread-dot"
              aria-label={t("workbuddy.unreadDotAria")}
            />
          )}
          <span className="truncate">{peerDisplay}</span>
        </div>
        <span className="mail-card-time">
          {formatAgentMailTime(item.createdAt, lang, "list")}
        </span>
      </div>

      <div className="mail-card-subject truncate">
        {item.subject || t("workbuddy.noSubject")}
      </div>

      {!compact && item.snippet && (
        <div className="mail-card-snippet wb-card-snippet">{item.snippet}</div>
      )}

      <div className="mail-card-bottom">
        <span className="source-tag truncate" data-provider="workbuddy">
          {t("workbuddy.sourceTag")}
        </span>
        <div className="mail-card-meta-right">
          {item.hasAttachments && <Icon name="paperclip" size={12} />}
          {rightStatus && (
            <span className="wb-card-meta-status">{rightStatus}</span>
          )}
        </div>
      </div>
    </button>
  );
}
