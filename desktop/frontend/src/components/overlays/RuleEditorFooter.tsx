import type { RulePreviewResult } from "../../services/backendClient";

export function RulePreviewCard({ preview }: { preview: RulePreviewResult }) {
  return (
    <div className="settings-card" style={{ padding: "10px 12px" }}>
      <strong className="text-xs">
        干跑预览：最近 30 天内预计命中 {preview.hitCount} 封邮件
      </strong>
      {(preview.samples ?? []).map((s) => (
        <div key={s.id} className="text-xs text-muted truncate">
          · {s.subject}（{s.senderEmail}）
        </div>
      ))}
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
  return (
    <>
      <div className="row" style={{ gap: 6 }}>
        {hasExisting && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={onDelete}
          >
            删除
          </button>
        )}
        <button
          type="button"
          disabled={!canPreview}
          className="btn btn-secondary btn-sm"
          onClick={onPreview}
        >
          测试命中预览
        </button>
      </div>
      <div className="row">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          onClick={onSave}
        >
          保存规则
        </button>
      </div>
    </>
  );
}
