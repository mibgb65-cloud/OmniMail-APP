import { useCallback, useEffect, useState } from "react";
import { CheckForUpdates } from "../../../bindings/omnimail/desktopservice";
import type { UpdateCheckResult } from "../../../bindings/omnimail/models";
import { formatUnixTimestamp, useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { openSafeExternalUrl } from "../../state/desktopActions";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { UpdateStage } from "../../types/ui";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

function formatVersionTag(raw?: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "v0.0.1";
  return s.startsWith("v") || s.startsWith("V") ? s : `v${s}`;
}

export function UpdateFlowModal({
  stage: _initialStage,
}: {
  stage: UpdateStage;
}) {
  const { workspace } = useApp();
  const { lang, isEn, t, formatTime } = useI18n();
  const [status, setStatus] = useState<AsyncActionStatus>("loading");
  const [result, setResult] = useState<UpdateCheckResult | null>(null);

  const runCheck = useCallback(async () => {
    setStatus("loading");
    if (!isWailsDesktop()) {
      await new Promise((r) => window.setTimeout(r, 380));
      setResult({
        currentVersion: "v0.0.1",
        latestVersion: "v0.0.1",
        channel: "stable",
        hasUpdate: false,
        releaseUrl: "https://github.com/omnimail-org/omnimail/releases",
        releaseNotes: t("overlays.updatePreviewNotes"),
        checkedAt: formatUnixTimestamp(Date.now(), lang),
      });
      setStatus("success");
      return;
    }
    try {
      const res = await CheckForUpdates();
      setResult(res);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, [lang, t]);

  useEffect(() => {
    void _initialStage;
    const timer = window.setTimeout(() => {
      void runCheck();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [_initialStage, runCheck]);

  const checking = status === "loading";
  const rawNotes = result?.releaseNotes ?? "";
  const localizedNotes = !rawNotes
    ? t("overlays.updateNoNotesFallback")
    : isEn && rawNotes.startsWith("当前运行的是 OmniMail 开源")
      ? t("overlays.updatePreviewNotes")
      : rawNotes;
  const checkedSuffix = result?.checkedAt
    ? ` · ${formatTime(result.checkedAt)}`
    : "";

  return (
    <ModalShell
      heading={t("overlays.updateHeading")}
      subtitle={`${t("overlays.updateSubtitle", {
        version: formatVersionTag(result?.currentVersion),
        beta: result?.channel === "beta" ? " (Beta)" : "",
      })}${checkedSuffix}`}
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <AsyncActionButton
            size="sm"
            variant="secondary"
            status={status}
            idleIcon="refresh"
            idleLabel={t("overlays.updateRecheckIdle")}
            loadingLabel={t("overlays.updateRecheckLoading")}
            successLabel={
              result?.hasUpdate
                ? t("overlays.updateHasNewBtn")
                : t("overlays.updateUpToDateBtn")
            }
            errorLabel={t("overlays.updateQueryError")}
            successHoldMs={1000}
            onSuccessHoldEnd={() => setStatus("idle")}
            onClick={() => void runCheck()}
          />
          <div className="row" style={{ gap: 8 }}>
            {result?.releaseUrl && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void openSafeExternalUrl(result.releaseUrl)}
              >
                <Icon name="external" size={14} />{" "}
                {t("overlays.updateOpenGithubBtn")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              {t("common.close")}
            </button>
          </div>
        </>
      }
    >
      <div className="settings-card">
        <div className="row-between">
          <strong>
            {checking
              ? t("overlays.updateCheckingGithubTitle")
              : result?.hasUpdate
                ? t("overlays.updateFoundVersionTitle", {
                    version: formatVersionTag(result.latestVersion),
                  })
                : t("overlays.updateCurrentLatestTitle")}
          </strong>
          <span
            className={`pill ${checking ? "pill-accent" : result?.hasUpdate ? "pill-warning" : "pill-success"}`}
          >
            {checking
              ? t("overlays.updateBadgeChecking")
              : result?.hasUpdate
                ? t("overlays.updateBadgeHasUpdate")
                : t("overlays.updateBadgeLatest")}
          </span>
        </div>
        <div
          className="text-xs text-muted"
          style={{ lineHeight: 1.65, whiteSpace: "pre-line" }}
        >
          {checking ? t("overlays.updateCheckingDesc") : localizedNotes}
        </div>
      </div>
    </ModalShell>
  );
}
