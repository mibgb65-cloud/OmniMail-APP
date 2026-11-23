import { useEffect, useRef, useState } from "react";
import type { ProbeStepResult } from "../../../bindings/omnimail/internal/mailproto/models";
import { AsyncStateGlyph } from "./AsyncStateGlyph";

export interface HandshakeReportLike {
  ok?: boolean;
  summary?: string;
  proxyHint?: string;
  discoveredMailboxes?: number;
  steps?: ProbeStepResult[] | null;
}

const CANONICAL_STEPS = [
  {
    stage: "dns",
    num: 1,
    short: "1/4 DNS",
    title: "1. DNS 解析与服务器可达性",
  },
  { stage: "tls", num: 2, short: "2/4 TLS", title: "2. TLS 安全证书握手" },
  {
    stage: "imap",
    num: 3,
    short: "3/4 IMAP",
    title: "3. IMAP 登录认证与目录识别",
  },
  { stage: "smtp", num: 4, short: "4/4 SMTP", title: "4. SMTP 发件服务器认证" },
] as const;

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
  const [activeIdx, setActiveIdx] = useState(0);
  const cbRef = useRef(onStepLabelChange);

  useEffect(() => {
    cbRef.current = onStepLabelChange;
  }, [onStepLabelChange]);

  useEffect(() => {
    if (!running) return;
    const resetTimer = window.setTimeout(() => {
      setActiveIdx(0);
      cbRef.current?.(`正在执行四步握手 (${CANONICAL_STEPS[0].short})…`);
    }, 0);
    const interval = window.setInterval(() => {
      setActiveIdx((prev) => {
        const next = Math.min(3, prev + 1);
        cbRef.current?.(`正在执行四步握手 (${CANONICAL_STEPS[next].short})…`);
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
    ? `进行中 · ${activeIdx + 1} / 4`
    : allOk
      ? `全部通过 · 4 / 4${report?.discoveredMailboxes ? ` (${report.discoveredMailboxes} 文件夹)` : ""}`
      : `步骤 ${(failedIdx >= 0 ? failedIdx : 0) + 1} 受阻`;

  const headerSummary = running
    ? endpointHint
      ? `正在连接验证 ${endpointHint}…`
      : "正在按顺序验证收发协议链路…"
    : [report?.proxyHint, report?.summary].filter(Boolean).join(" · ") ||
      (allOk ? "四步安全握手全部通过" : "连接验证未通过，请核对下方提示");

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
              ? "校验中…"
              : phase === "pending"
                ? "等待前序完成"
                : phase === "done"
                  ? real
                    ? [
                        real.detail,
                        real.durationMs > 0 ? `${real.durationMs}ms` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "已通过"
                    : idx === 0 && endpointHint
                      ? endpointHint
                      : "校验通过"
                  : real?.durationMs
                    ? `耗时 ${real.durationMs}ms`
                    : "未通过";

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
                    {real?.label ? `${meta.num}. ${real.label}` : meta.title}
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
