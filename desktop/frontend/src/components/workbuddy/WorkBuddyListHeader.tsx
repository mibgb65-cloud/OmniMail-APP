import { useRef, useState, type CSSProperties } from "react";
import { useI18n } from "../../i18n";
import {
  shouldShowDailyQuota,
  type WorkBuddyDailyQuota,
  type WorkBuddyDirection,
} from "../../types/workbuddy";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export function WorkBuddyListHeader({
  title,
  subtitle,
  dir,
  searchQuery,
  dailyQuota,
  listLoading,
  onChangeDir,
  onChangeSearch,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  dir: WorkBuddyDirection;
  searchQuery: string;
  dailyQuota: WorkBuddyDailyQuota;
  listLoading: boolean;
  onChangeDir: (next: WorkBuddyDirection) => void;
  onChangeSearch: (next: string) => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const hasSearch = Boolean(searchQuery.trim());
  const showSearchBox = searchOpen || hasSearch;
  const showQuota = shouldShowDailyQuota(dailyQuota);
  const activeTabIdx = dir === "sent" ? 1 : 0;

  return (
    <div className="list-header">
      <div className="list-title-row">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 6, minWidth: 0 }}>
            <h1 className="list-title truncate">{title}</h1>
            {showQuota && (
              <span className="wb-quota-pill">
                {t("workbuddy.quotaCompactBadge", {
                  remaining: dailyQuota.remaining,
                  limit: dailyQuota.limit,
                })}
              </span>
            )}
          </div>
          <p className="list-subtitle truncate">{subtitle}</p>
        </div>

        <div className="row" style={{ gap: 5, flexShrink: 0 }}>
          <Tooltip label={t("workbuddy.refreshBtn")}>
            <button
              type="button"
              className={`icon-btn icon-btn-bordered list-head-icon-btn${listLoading ? " is-spinning" : ""}`}
              disabled={listLoading}
              onClick={onRefresh}
              aria-label={t("workbuddy.refreshBtn")}
            >
              <Icon name="refresh" size={13} />
            </button>
          </Tooltip>
          <Tooltip label={t("workbuddy.toggleSearchTip")}>
            <button
              type="button"
              className={`icon-btn icon-btn-bordered list-head-icon-btn${showSearchBox ? " is-active" : ""}`}
              aria-pressed={showSearchBox}
              aria-label={t("workbuddy.toggleSearchTip")}
              onClick={() => {
                const next = !showSearchBox;
                setSearchOpen(next);
                if (next) {
                  setTimeout(() => searchInputRef.current?.focus(), 20);
                } else {
                  onChangeSearch("");
                }
              }}
            >
              <Icon name="search" size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      {showSearchBox && (
        <div className="wb-list-search-row">
          <Icon name="search" size={13} />
          <input
            ref={searchInputRef}
            className="wb-search-input"
            value={searchQuery}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder={t("workbuddy.searchPlaceholder")}
          />
          {searchQuery && (
            <button
              type="button"
              className="icon-btn wb-search-clear"
              aria-label={t("workbuddy.clearSearchAria")}
              onClick={() => onChangeSearch("")}
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      )}

      <div
        className="filter-tabs wb-filter-tabs"
        role="tablist"
        style={{ "--active-tab-idx": activeTabIdx } as CSSProperties}
      >
        <span className="filter-tabs-indicator" aria-hidden="true" />
        {(["inbox", "sent"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={dir === id}
            className={`filter-tab ${dir === id ? "active" : ""}`}
            onClick={() => onChangeDir(id)}
          >
            {t(id === "inbox" ? "workbuddy.inboxTab" : "workbuddy.sentTab")}
          </button>
        ))}
      </div>

      <div
        className="list-refresh-bar"
        data-active={listLoading}
        aria-hidden="true"
      >
        <span className="list-refresh-bar-fill" />
      </div>
    </div>
  );
}
