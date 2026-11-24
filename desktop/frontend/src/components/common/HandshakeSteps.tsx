import { useEffect, useRef, useState } from "react";
import type { ProbeStepResult } from "../../../bindings/omnimail/internal/mailproto/models";
import { useI18n, type TranslationKey } from "../../i18n";
import { AsyncStateGlyph } from "./AsyncStateGlyph";

export interface HandshakeReportLike {
  ok?: boolean;
  summary?: string;
  proxyHint?: string;
  discoveredMailboxes?: number;
  steps?: ProbeStepResult[] | null;
}

const CANONICAL_STEPS: ReadonlyArray<{
  stage: string;
  num: number;
  short: string;
  titleKey: TranslationKey;
}> = [
  { stage: "dns", num: 1, short: "1/4 DNS", titleKey: "common.handshakeStep1" },
  { stage: "tls", num: 2, short: "2/4 TLS", titleKey: "common.handshakeStep2" },
  {
    stage: "imap",
    num: 3,
    short: "3/4 IMAP",
    titleKey: "common.handshakeStep3",
  },
  {
    stage: "smtp",
    num: 4,
    short: "4/4 SMTP",
    titleKey: "common.handshakeStep4",
  },
];

export function HandshakeSteps({
  running,
  report,
  endpointHint,
  onStepLabelChange,
}: {
  running: boolean;
  report: HandshakeReportLike | null;
  endpointHint?: string;
  onStepLabelChange?: (loadingText: string) => void;
}) {
  const { t } = useI18n();
  const [activeIdx, setActiveIdx] = useState(0);
  const cbRef = useRef(onStepLabelChange);
  const tRef = useRef(t);

  useEffect(() => {
    cbRef.current = onStepLabelChange;
    tRef.current = t;
  }, [onStepLabelChange, t]);

  useEffect(() => {
    if (!running) return;
    const resetTimer = window.setTimeout(() => {
      setActiveIdx(0);
      cbRef.current?.(
        tRef.current("common.handshakeRunning", {
          step: CANONICAL_STEPS[0].short,
        }),
      );
    }, 0);
    const interval = window.setInterval(() => {
      setActiveIdx((prev) => {
        const next = Math.min(3, prev + 1);
        cbRef.current?.(
          tRef.current("common.handshakeRunning", {
            step: CANONICAL_STEPS[next].short,
          }),
        );
        return next;
      });
    }, 310);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearInterval(interval);
    };
  }, [running]);

  if (!running && !report) return null;

  const rawSteps = report?.steps ?? [];
  const allOk =
    !running &&
    Boolean(
      report &&
      (report.ok ?? (rawSteps.length > 0 && rawSteps.every((s) => s.ok))),
    );
  const failedIdx =
    !running && report && !allOk ? rawSteps.findIndex((s) => !s.ok) : -1;

  const badgeTone = running ? "running" : allOk ? "done" : "failed";
  const badgeText = running
    ? t("common.handshakeBadgeRunning", { current: activeIdx + 1 })
    : allOk
      ? report?.discoveredMailboxes
        ? t("common.handshakeBadgePassedBoxes", {
            count: report.discoveredMailboxes,
          })
        : t("common.handshakeBadgePassed")
      : t("common.handshakeBadgeBlocked", {
          step: (failedIdx >= 0 ? failedIdx : 0) + 1,
        });

  const headerSummary = running
    ? endpointHint
      ? t("common.handshakeConnecting", { endpoint: endpointHint })
      : t("common.handshakeVerifyingChain")
    : [report?.proxyHint, report?.summary].filter(Boolean).join(" · ") ||
      (allOk ? t("common.handshakeAllOk") : t("common.handshakeFailedHint"));

  return (
    <div className="handshake-card" role="status" aria-live="polite">
      <div className="handshake-head">
        <span className="handshake-summary truncate">{headerSummary}</span>
        <span className="handshake-badge" data-tone={badgeTone}>
          {badgeText}
        </span>
      </div>

      <div className="handshake-list">
        {CANONICAL_STEPS.map((meta, idx) => {
          const real = rawSteps[idx];
          const phase: "done" | "active" | "failed" | "pending" = running
            ? idx < activeIdx
              ? "done"
              : idx === activeIdx
                ? "active"
                : "pending"
            : allOk || (failedIdx > idx && Boolean(real?.ok))
              ? "done"
              : idx === failedIdx || (failedIdx === -1 && !allOk && idx === 0)
                ? "failed"
                : "pending";

          const rightMeta =
            phase === "active"
              ? t("common.handshakeChecking")
              : phase === "pending"
                ? t("common.handshakePending")
                : phase === "done"
                  ? real
                    ? [
                        real.detail,
                        real.durationMs > 0 ? `${real.durationMs}ms` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || t("common.handshakePassed")
                    : idx === 0 && endpointHint
                      ? endpointHint
                      : t("common.handshakeVerified")
                  : real?.durationMs
                    ? t("common.handshakeDuration", { ms: real.durationMs })
                    : t("common.handshakeFailed");

          const errTip =
            phase === "failed"
              ? real?.suggestion || real?.detail || report?.summary
              : "";

          return (
            <div key={meta.stage} className="handshake-step" data-phase={phase}>
              <div className="handshake-step-row">
                <div className="handshake-step-left">
                  <span className="handshake-dot" data-phase={phase}>
                    {phase === "active" ? (
                      <AsyncStateGlyph status="loading" size={14} />
                    ) : phase === "done" ? (
                      <AsyncStateGlyph status="success" size={13} />
                    ) : phase === "failed" ? (
                      <AsyncStateGlyph status="error" size={13} />
                    ) : (
                      meta.num
                    )}
                  </span>
                  <span className="handshake-step-title truncate">
                    {real?.label
                      ? `${meta.num}. ${real.label}`
                      : t(meta.titleKey)}
                  </span>
                </div>
                <span className="handshake-step-right truncate">
                  {rightMeta}
                </span>
              </div>
              {errTip && <div className="handshake-step-err">{errTip}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
