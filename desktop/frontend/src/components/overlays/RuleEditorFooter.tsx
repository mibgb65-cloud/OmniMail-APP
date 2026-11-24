import type { ReactNode } from "react";
import { useI18n } from "../../i18n";
import type { RulePreviewResult } from "../../services/backendClient";

export function RuleFieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

export function RulePreviewCard({ preview }: { preview: RulePreviewResult }) {
  const { isEn, t, localizeText } = useI18n();

  return (
    <div className="settings-card" style={{ padding: "10px 12px" }}>
      <strong className="text-xs">
        {t("overlays.ruleDryRunTitle", { count: preview.hitCount })}
      </strong>
      {(preview.samples ?? []).map((s) => {
        const subj =
          s.subject === "示例命中邮件预览"
            ? t("overlays.ruleSamplePreviewSubject")
            : localizeText(s.subject);
        return (
          <div key={s.id} className="text-xs text-muted truncate">
            · {subj}
            {isEn ? ` (${s.senderEmail})` : `（${s.senderEmail}）`}
          </div>
        );
      })}
    </div>
  );
}

interface RuleEditorFooterProps {
  hasExisting: boolean;
  canPreview: boolean;
  canSave: boolean;
  onDelete: () => void;
  onPreview: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function RuleEditorFooter({
  hasExisting,
  canPreview,
  canSave,
  onDelete,
  onPreview,
  onCancel,
  onSave,
}: RuleEditorFooterProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="row" style={{ gap: 6 }}>
        {hasExisting && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={onDelete}
          >
            {t("common.delete")}
          </button>
        )}
        <button
          type="button"
          disabled={!canPreview}
          className="btn btn-secondary btn-sm"
          onClick={onPreview}
        >
          {t("overlays.ruleTestPreviewBtn")}
        </button>
      </div>
      <div className="row">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          onClick={onSave}
        >
          {t("overlays.ruleSaveBtn")}
        </button>
      </div>
    </>
  );
}
