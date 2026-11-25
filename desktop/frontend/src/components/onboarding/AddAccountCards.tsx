import { useI18n } from "../../i18n";
import type { ProviderCatalogItem } from "../../types/account";
import { ProviderIcon } from "../common/ProviderIcon";

function resolveBadgeClass(tone: ProviderCatalogItem["badgeTone"]): string {
  if (tone === "blue") return "pill pill-accent";
  if (tone === "violet") return "pill pill-ai";
  if (tone === "amber") return "pill pill-warning";
  return "pill pill-neutral";
}

export function ProviderOptionCard({
  item,
  onSelect,
}: {
  item: ProviderCatalogItem;
  onSelect: (item: ProviderCatalogItem) => void;
}) {
  return (
    <button
      type="button"
      className="aam-provider-card"
      onClick={() => onSelect(item)}
    >
      <div className="aam-card-main">
        <ProviderIcon provider={item.id} size={34} />
        <div className="aam-card-meta">
          <span className="aam-card-name truncate">{item.name}</span>
          <span className="aam-card-sub truncate">{item.subtitle}</span>
        </div>
      </div>
      <span className={`${resolveBadgeClass(item.badgeTone)} aam-card-badge`}>
        {item.badgeText}
      </span>
    </button>
  );
}

export function CustomBalanceCard({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="aam-provider-card is-custom-balance"
      onClick={onClick}
    >
      <div className="aam-card-main">
        <ProviderIcon provider="imap" size={34} />
        <div className="aam-card-meta">
          <span className="aam-card-name truncate">
            {t("onboarding.pickerCustomCardTitle")}
          </span>
          <span className="aam-card-sub truncate">
            {t("onboarding.pickerCustomCardSub")}
          </span>
        </div>
      </div>
      <span className="pill pill-neutral aam-card-badge">
        {t("onboarding.pickerCustomCardBadge")}
      </span>
    </button>
  );
}
