import { type CSSProperties, useRef } from "react";
import { useI18n } from "../../../i18n";
import type { EmailAccount, ProviderId } from "../../../types/account";
import { Icon } from "../../common/Icon";
import { ProviderIcon } from "../../common/ProviderIcon";
import { Tooltip } from "../../common/Tooltip";
import {
  resolveQuickReplyIdentity,
  useQuickReplyPillLayout,
} from "./useQuickReplyPillLayout";

const compactBtnStyle = { height: 28, padding: "0 12px", flexShrink: 0 };

export interface QuickReplyHeaderProps {
  senderName: string;
  account?: EmailAccount;
  fallbackProvider: ProviderId;
  isOpen: boolean;
  showCollapse: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}

export function QuickReplyHeader({
  senderName,
  account,
  fallbackProvider,
  isOpen,
  showCollapse,
  onExpand,
  onCollapse,
}: QuickReplyHeaderProps) {
  const { lang, t } = useI18n();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const measureHostRef = useRef<HTMLDivElement | null>(null);
  const identity = resolveQuickReplyIdentity(account, lang);
  const provider = account?.provider ?? fallbackProvider;

  const headerTitle = isOpen
    ? t("reader.quickReplyOpenHeader", { sender: senderName })
    : t("reader.quickReplyCollapsedHeader", {
        sender: senderName,
        account: identity.collapsedAccountText,
      });

  const stage = useQuickReplyPillLayout(
    headerRef,
    measureHostRef,
    isOpen,
    `${lang}:${headerTitle}:${identity.prefixText}:${identity.coreEmail}:${showCollapse}`,
  );
  const hidePrefix = stage !== "full";

  const titleStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: isOpen ? 600 : 400,
    color: isOpen ? "var(--text-ink)" : "var(--text-muted)",
  };

  return (
    <>
      <div
        ref={headerRef}
        className="quick-reply-header"
        style={{ cursor: isOpen ? "default" : "text" }}
        onClick={() => !isOpen && onExpand()}
      >
        <span className="quick-reply-header-title">
          <Icon name="reply" size={14} />
          <span className="truncate" style={titleStyle}>
            {headerTitle}
          </span>
        </span>

        {isOpen ? (
          <div className="quick-reply-header-right" data-stage={stage}>
            <Tooltip label={identity.tooltipText} placement="top">
              <span
                className="pill pill-neutral quick-reply-lock-pill"
                data-stage={stage}
                aria-label={identity.tooltipText}
              >
                <ProviderIcon provider={provider} size={15} bare />
                {!hidePrefix && (
                  <span className="quick-reply-pill-prefix">
                    {identity.prefixText}
                  </span>
                )}
                <span className="quick-reply-pill-email">
                  {identity.coreEmail}
                </span>
                <Icon name="lock" size={11} />
              </span>
            </Tooltip>

            {showCollapse && (
              <button
                data-quick-reply-collapse=""
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0 }}
                onClick={onCollapse}
              >
                {t("reader.quickReplyCollapse")}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            style={compactBtnStyle}
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          >
            {t("reader.reply")}
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={measureHostRef}
          className="quick-reply-measure-host"
          aria-hidden="true"
        >
          <span data-measure="title" className="row" style={{ gap: 7 }}>
            <Icon name="reply" size={14} />
            <span style={titleStyle}>{headerTitle}</span>
          </span>
          <span
            data-measure="full"
            className="pill pill-neutral quick-reply-lock-pill"
          >
            <ProviderIcon provider={provider} size={15} bare />
            <span className="quick-reply-pill-prefix">
              {identity.prefixText}
            </span>
            <span className="quick-reply-pill-email">{identity.coreEmail}</span>
            <Icon name="lock" size={11} />
          </span>
          <span
            data-measure="email"
            className="pill pill-neutral quick-reply-lock-pill"
          >
            <ProviderIcon provider={provider} size={15} bare />
            <span className="quick-reply-pill-email">{identity.coreEmail}</span>
            <Icon name="lock" size={11} />
          </span>
        </div>
      )}
    </>
  );
}
