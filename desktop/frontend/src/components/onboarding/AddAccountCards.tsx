import { useI18n } from "../../i18n";
import type { ProviderCatalogItem, ProviderId } from "../../types/account";
import { Icon } from "../common/Icon";
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

export function EnterpriseExtraBanners({
  onSelectOAuth,
  onOpenManualImap,
}: {
  onSelectOAuth: (provider: ProviderId) => void;
  onOpenManualImap: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="aam-ent-extras">
      <div className="aam-ent-banner">
        <div className="aam-ent-banner-meta">
          <strong className="aam-card-name truncate">
            {t("onboarding.pickerEnterpriseOAuthTitle")}
          </strong>
          <span className="aam-card-sub truncate">
            {t("onboarding.pickerEnterpriseOAuthSub")}
          </span>
        </div>
        <div className="aam-ent-banner-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSelectOAuth("outlook")}
          >
            {t("onboarding.pickerEnterpriseM365Btn")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSelectOAuth("gmail")}
          >
            {t("onboarding.pickerEnterpriseGwsBtn")}
          </button>
        </div>
      </div>

      <div className="aam-ent-banner">
        <div className="aam-card-main">
          <ProviderIcon provider="imap" size={34} />
          <div className="aam-card-meta">
            <strong className="aam-card-name truncate">
              {t("onboarding.pickerEnterpriseManualTitle")}
            </strong>
            <span className="aam-card-sub truncate">
              {t("onboarding.pickerEnterpriseManualSub")}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onOpenManualImap}
        >
          <span>{t("onboarding.pickerEnterpriseManualBtn")}</span>
          <Icon name="arrowRight" size={13} />
        </button>
      </div>
    </div>
  );
}
