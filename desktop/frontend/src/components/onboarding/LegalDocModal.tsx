import { LEGAL_DOCS } from "../../data/settingsDefaults";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function LegalDocModal({ doc }: { doc: "terms" | "privacy" }) {
  const { workspace } = useApp();
  const data = LEGAL_DOCS[doc];

  return (
    <ModalShell
      title={`OmniMail ${data.title}`}
      subtitle={`${data.badge} · ${data.updatedAt}`}
      maxWidth={600}
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
              用户协议
            </button>
            <button
              type="button"
              className={`btn btn-sm ${doc === "privacy" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.setOverlay({ type: "legal-doc", doc: "privacy" })
              }
            >
              隐私政策
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            我已知晓
          </button>
        </>
      }
    >
      <div className="pill pill-warning" style={{ alignSelf: "flex-start" }}>
        <Icon name="info" size={13} />
        本协议文本为界面设计预览草案，正式发版前将替换为法务定稿版本。
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
