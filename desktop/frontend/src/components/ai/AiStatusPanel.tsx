import { useI18n, type TranslationKey } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { AiRunStatus } from "../../types/workspace";
import { Icon } from "../common/Icon";

const STATUS_META: Record<
  Exclude<AiRunStatus, "idle" | "processing">,
  {
    tone: "warning" | "danger";
    titleKey: TranslationKey;
    detailKey: TranslationKey;
    actionKey: TranslationKey;
  }
> = {
  error: {
    tone: "danger",
    titleKey: "ai.errFailedTitle",
    detailKey: "ai.errFailedDetail",
    actionKey: "ai.retryCurrentAction",
  },
  "invalid-key": {
    tone: "danger",
    titleKey: "ai.errInvalidKeyTitle",
    detailKey: "ai.errInvalidKeyDetail",
    actionKey: "ai.errInvalidKeyAction",
  },
  "quota-exceeded": {
    tone: "warning",
    titleKey: "ai.errQuotaTitle",
    detailKey: "ai.errQuotaDetail",
    actionKey: "ai.errQuotaAction",
  },
  unavailable: {
    tone: "warning",
    titleKey: "ai.errUnavailableTitle",
    detailKey: "ai.errUnavailableDetail",
    actionKey: "ai.errUnavailableAction",
  },
  "disabled-sensitive": {
    tone: "warning",
    titleKey: "ai.errSensitiveTitle",
    detailKey: "ai.errSensitiveDetail",
    actionKey: "ai.errSensitiveAction",
  },
};

export function AiStatusPanel({
  status,
  detail,
  onRetry,
}: {
  status: AiRunStatus;
  detail: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const { workspace, aiStore } = useApp();

  if (status === "processing") {
    return (
      <div className="ai-status-box">
        <div className="ai-card-head">
          <span className="row" style={{ color: "var(--brand-ai)" }}>
            <Icon name="sparkle" size={14} /> {t("ai.processingTitle")}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => aiStore.stopGeneration()}
          >
            {t("ai.stopGenerating")}
          </button>
        </div>
        <div className="text-muted text-xs">
          {t("ai.processingPrivacyHint")}
        </div>
      </div>
    );
  }

  if (status === "idle") return null;

  const meta = STATUS_META[status];
  return (
    <div className={`ai-status-box ${meta.tone}`}>
      <div className="row-between">
        <strong>{t(meta.titleKey)}</strong>
        <Icon name="alertCircle" size={15} />
      </div>
      <div style={{ lineHeight: 1.5 }}>
        {status === "error" && detail ? detail : t(meta.detailKey)}
      </div>
      <div className="row">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (status === "invalid-key" || status === "quota-exceeded") {
              workspace.setOverlay({ type: "settings", tab: "ai" });
            } else if (status === "disabled-sensitive") {
              workspace.setOverlay({ type: "settings", tab: "privacy" });
            } else if (status === "unavailable") {
              aiStore.dismissStatus();
            } else {
              onRetry();
            }
          }}
        >
          {t(meta.actionKey)}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={aiStore.dismissStatus}
        >
          {t("ai.dismissBtn")}
        </button>
      </div>
    </div>
  );
}
