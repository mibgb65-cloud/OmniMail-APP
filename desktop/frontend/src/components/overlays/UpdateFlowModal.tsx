import { useCallback, useEffect, useState } from "react";
import { CheckForUpdates } from "../../../bindings/omnimail/desktopservice";
import type { UpdateCheckResult } from "../../../bindings/omnimail/models";
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
        releaseNotes: "当前运行的是 OmniMail 开源稳定版（v0.0.1）。",
        checkedAt: "刚刚",
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
  }, []);

  useEffect(() => {
    void _initialStage;
    const timer = window.setTimeout(() => {
      void runCheck();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [_initialStage, runCheck]);

  const checking = status === "loading";

  return (
    <ModalShell
      heading="开源版本更新检查"
      subtitle={`当前版本：${formatVersionTag(result?.currentVersion)}${result?.channel === "beta" ? " (Beta)" : ""} · 只读查询 GitHub Releases，不静默替换程序`}
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <AsyncActionButton
            size="sm"
            variant="secondary"
            status={status}
            idleIcon="refresh"
            idleLabel="重新检查更新"
            loadingLabel="正在比对版本…"
            successLabel={result?.hasUpdate ? "发现新版本" : "已是最新版本"}
            errorLabel="查询失败 · 重试"
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
                <Icon name="external" size={14} /> 前往 GitHub Releases
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              关闭
            </button>
          </div>
        </>
      }
    >
      <div className="settings-card">
        <div className="row-between">
          <strong>
            {checking
              ? "正在检查 GitHub 最新发行版…"
              : result?.hasUpdate
                ? `发现新版本 ${formatVersionTag(result.latestVersion)}`
                : "当前已是最新版本"}
          </strong>
          <span
            className={`pill ${checking ? "pill-accent" : result?.hasUpdate ? "pill-warning" : "pill-success"}`}
          >
            {checking ? "检查中" : result?.hasUpdate ? "有新版本" : "最新"}
          </span>
        </div>
        <div
          className="text-xs text-muted"
          style={{ lineHeight: 1.65, whiteSpace: "pre-line" }}
        >
          {checking
            ? "正在通过只读 HTTPS 请求比对最新发行版标签…"
            : result?.releaseNotes || "暂无更新说明。"}
        </div>
      </div>
    </ModalShell>
  );
}
