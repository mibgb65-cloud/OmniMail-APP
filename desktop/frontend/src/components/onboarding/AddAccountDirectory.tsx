import { useI18n } from "../../i18n";
import type { ProviderCatalogItem } from "../../types/account";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { CustomBalanceCard, ProviderOptionCard } from "./AddAccountCards";
import type {
  FilteredPickerDirectory,
  PickerCategoryFilter,
} from "./addAccountCatalog";

export interface AddAccountDirectoryProps {
  activeCategory: PickerCategoryFilter;
  searchQuery: string;
  directory: FilteredPickerDirectory;
  onSearchChange: (next: string) => void;
  onSelectProvider: (item: ProviderCatalogItem) => void;
  onOpenManualImap: () => void;
}

export function AddAccountDirectory({
  activeCategory,
  searchQuery,
  directory,
  onSearchChange,
  onSelectProvider,
  onOpenManualImap,
}: AddAccountDirectoryProps) {
  const { t } = useI18n();

  const categoryLabel =
    activeCategory === "agent"
      ? t("onboarding.pickerCatAgent")
      : activeCategory === "standard"
        ? t("onboarding.pickerCatStandard")
        : t("onboarding.pickerCatAll");

  return (
    <section className="aam-directory">
      <div className="aam-toolbar">
        <div className="aam-search-box">
          <Icon name="search" size={14} className="aam-search-icon" />
          <input
            type="text"
            className="aam-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("onboarding.pickerSearchPlaceholder")}
            aria-label={t("onboarding.pickerSearchAria")}
          />
          {searchQuery && (
            <button
              type="button"
              className="icon-btn aam-search-clear"
              aria-label={t("onboarding.pickerClearSearchAria")}
              onClick={() => onSearchChange("")}
            >
              <Icon name="x" size={13} />
            </button>
          )}
        </div>

        <span className="aam-summary-count">
          {t("onboarding.pickerSummaryCount", {
            category: categoryLabel,
            count: directory.matched.length,
          })}
        </span>
      </div>

      <FadeScroll
        key={`${activeCategory}:${directory.hasQuery ? "q" : "all"}`}
        className="aam-scroll"
        label={categoryLabel}
      >
        {directory.matched.length === 0 ? (
          <div className="aam-empty-state">
            <span className="aam-empty-icon" aria-hidden="true">
              <Icon name="search" size={18} />
            </span>
            <strong className="aam-empty-title">
              {t("onboarding.pickerEmptyTitle")}
            </strong>
            <p className="aam-empty-desc">{t("onboarding.pickerEmptyDesc")}</p>
            <div className="aam-empty-actions">
              {directory.hasQuery && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSearchChange("")}
                >
                  {t("onboarding.pickerClearSearchBtn")}
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onOpenManualImap}
              >
                <Icon name="server" size={13} />
                <span>{t("onboarding.pickerManualBtn")}</span>
              </button>
            </div>
          </div>
        ) : activeCategory === "all" && !directory.hasQuery ? (
          <div className="aam-sections">
            {directory.agentItems.length > 0 && (
              <div className="aam-section-block">
                <div className="aam-section-head">
                  <div className="aam-section-title-row">
                    <strong className="aam-section-title">
                      {t("onboarding.pickerCatAgent")}
                    </strong>
                    <span className="aam-section-badge">
                      {directory.agentItems.length}
                    </span>
                  </div>
                  <span className="aam-section-hint">
                    {t("onboarding.pickerGroupAgentHint")}
                  </span>
                </div>
                <div className="aam-grid">
                  {directory.agentItems.map((item) => (
                    <ProviderOptionCard
                      key={item.id}
                      item={item}
                      onSelect={onSelectProvider}
                    />
                  ))}
                </div>
              </div>
            )}

            {directory.standardItems.length > 0 && (
              <div className="aam-section-block">
                <div className="aam-section-head">
                  <div className="aam-section-title-row">
                    <strong className="aam-section-title">
                      {t("onboarding.pickerCatStandard")}
                    </strong>
                    <span className="aam-section-badge">
                      {directory.standardItems.length}
                    </span>
                  </div>
                  <span className="aam-section-hint">
                    {t("onboarding.pickerGroupStandardHint")}
                  </span>
                </div>
                <div className="aam-grid">
                  {directory.standardItems.map((item) => (
                    <ProviderOptionCard
                      key={item.id}
                      item={item}
                      onSelect={onSelectProvider}
                    />
                  ))}
                  {directory.showCustomBalanceCard && (
                    <CustomBalanceCard onClick={onOpenManualImap} />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="aam-grid">
            {directory.matched.map((item) => (
              <ProviderOptionCard
                key={item.id}
                item={item}
                onSelect={onSelectProvider}
              />
            ))}
            {directory.showCustomBalanceCard && (
              <CustomBalanceCard onClick={onOpenManualImap} />
            )}
          </div>
        )}
      </FadeScroll>
    </section>
  );
}
