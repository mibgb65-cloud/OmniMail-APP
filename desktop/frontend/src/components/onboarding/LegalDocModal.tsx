import { getLegalDoc, useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function LegalDocModal({ doc }: { doc: "terms" | "privacy" }) {
  const { workspace } = useApp();
  const { lang, t } = useI18n();
  const data = getLegalDoc(doc, lang);

  return (
    <ModalShell
      heading={`OmniMail ${data.title}`}
      badge={<span className="pill pill-accent">{data.badge}</span>}
      subtitle={data.updatedAt}
      maxWidth={640}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${doc === "terms" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.setOverlay({ type: "legal-doc", doc: "terms" })
              }
            >
              {t("onboarding.legalTermsTab")}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${doc === "privacy" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.setOverlay({ type: "legal-doc", doc: "privacy" })
              }
            >
              {t("onboarding.legalPrivacyTab")}
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            {t("onboarding.legalGotItBtn")}
          </button>
        </>
      }
    >
      <div className="pill pill-success" style={{ alignSelf: "flex-start" }}>
        <Icon name="shield" size={13} />
        <span>
          {doc === "terms"
            ? t("onboarding.legalTermsPledge")
            : t("onboarding.legalPrivacyPledge")}
        </span>
      </div>

      {data.sections.map((sec) => (
        <div key={sec.heading} className="settings-card">
          <strong style={{ fontSize: 14, color: "var(--text-ink)" }}>
            {sec.heading}
          </strong>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--text-body)",
            }}
          >
            {sec.body}
          </p>
        </div>
      ))}
    </ModalShell>
  );
}
