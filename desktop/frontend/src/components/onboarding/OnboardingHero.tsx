import { useI18n, type TranslationKey } from "../../i18n";
import { Icon, type IconName } from "../common/Icon";

const HIGHLIGHTS: Array<{
  icon: IconName;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  {
    icon: "inbox",
    titleKey: "onboarding.heroFeat1Title",
    descKey: "onboarding.heroFeat1Desc",
  },
  {
    icon: "lock",
    titleKey: "onboarding.heroFeat2Title",
    descKey: "onboarding.heroFeat2Desc",
  },
  {
    icon: "sparkle",
    titleKey: "onboarding.heroFeat3Title",
    descKey: "onboarding.heroFeat3Desc",
  },
];

export function OnboardingHero() {
  const { t } = useI18n();

  return (
    <div>
      <span className="pill pill-accent">{t("onboarding.heroPill")}</span>
      <h1 className="onboarding-hero-title">
        {t("onboarding.heroTitleLine1")}
        <br />
        {t("onboarding.heroTitleLine2")}
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--text-body)",
          margin: "0 0 22px",
        }}
      >
        {t("onboarding.heroDesc")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {HIGHLIGHTS.map((item) => (
          <div key={item.titleKey} className="onboarding-feature-card">
            <div
              className="btn-icon"
              style={{
                background: "var(--bg-selected)",
                color: "var(--brand-accent)",
                flexShrink: 0,
              }}
            >
              <Icon name={item.icon} size={16} />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--text-ink)",
                }}
              >
                {t(item.titleKey)}
              </div>
              <div
                className="text-xs text-muted"
                style={{ marginTop: 3, lineHeight: 1.55 }}
              >
                {t(item.descKey)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
