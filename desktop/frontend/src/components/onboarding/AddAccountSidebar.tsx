import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import type { PickerCategoryFilter, PickerCounts } from "./addAccountCatalog";

export interface AddAccountSidebarProps {
  activeCategory: PickerCategoryFilter;
  counts: PickerCounts;
  onSelectCategory: (cat: PickerCategoryFilter) => void;
  onOpenManualImap: () => void;
}

export function AddAccountSidebar({
  activeCategory,
  counts,
  onSelectCategory,
  onOpenManualImap,
}: AddAccountSidebarProps) {
  const { t } = useI18n();

  const navItems: Array<{
    id: PickerCategoryFilter;
    label: string;
    count: number;
  }> = [
    {
      id: "all",
      label: t("onboarding.pickerCatAll"),
      count: counts.total,
    },
    {
      id: "agent",
      label: t("onboarding.pickerCatAgent"),
      count: counts.agent,
    },
    {
      id: "standard",
      label: t("onboarding.pickerCatStandard"),
      count: counts.standard,
    },
  ];

  return (
    <aside
      className="aam-sidebar"
      aria-label={t("onboarding.pickerCategoryHeading")}
    >
      <div className="aam-sidebar-top">
        <div className="aam-side-group">
          <div className="aam-side-heading">
            {t("onboarding.pickerCategoryHeading")}
          </div>
          <div className="aam-nav-list" role="tablist">
            {navItems.map((item) => {
              const active = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`aam-nav-item ${active ? "is-active" : ""}`}
                  onClick={() => onSelectCategory(item.id)}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="aam-nav-count">{item.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="aam-side-divider" />

        <div className="aam-side-group aam-auth-modes">
          <div className="aam-side-heading">
            {t("onboarding.pickerAuthModesHeading")}
          </div>
          <div className="aam-mode-tags">
            <span className="aam-mode-tag">
              {t("onboarding.pickerModeOAuth")}
            </span>
            <span className="aam-mode-tag">
              {t("onboarding.pickerModeAuthCode")}
            </span>
            <span className="aam-mode-tag">
              {t("onboarding.pickerModeAgentGateway")}
            </span>
          </div>
        </div>
      </div>

      <div className="aam-sidebar-bottom">
        <button
          type="button"
          className="aam-manual-quick-card"
          onClick={onOpenManualImap}
        >
          <span className="aam-manual-quick-icon" aria-hidden="true">
            <Icon name="server" size={16} />
          </span>
          <div className="aam-manual-quick-meta">
            <span className="aam-manual-quick-title truncate">
              {t("onboarding.pickerManualCardTitle")}
            </span>
            <span className="aam-manual-quick-sub truncate">
              {t("onboarding.pickerManualCardSub")}
            </span>
          </div>
          <Icon
            name="chevronRight"
            size={14}
            className="aam-manual-quick-arrow"
          />
        </button>

        <p className="aam-vault-footnote">
          {t("onboarding.pickerVaultFootnote")}
        </p>
      </div>
    </aside>
  );
}
