import { type RefObject, useLayoutEffect, useState } from "react";
import { localizeBuiltinText, translateWithLang } from "../../../i18n/index.ts";
import type { EmailAccount } from "../../../types/account.ts";
import type { LanguageCode } from "../../../types/settings.ts";

export type QuickReplyPillStage = "full" | "email-only" | "ellipsis";

export interface QuickReplyIdentity {
  providerLabel: string;
  coreEmail: string;
  prefixText: string;
  tooltipText: string;
  collapsedAccountText: string;
}

export interface QuickReplyWidthMetrics {
  headerWidth: number;
  titleNaturalWidth: number;
  fullPillWidth: number;
  emailOnlyPillWidth: number;
  collapseBtnWidth?: number;
  minTitleWidth?: number;
  headerGap?: number;
  rightGroupGap?: number;
}

export interface QuickReplyPillLayout {
  stage: QuickReplyPillStage;
  hidePrefix: boolean;
  emailTruncated: boolean;
}

const DEFAULT_MIN_TITLE_WIDTH = 96;
const DEFAULT_HEADER_GAP = 10;
const DEFAULT_RIGHT_GAP = 6;
const HYSTERESIS_PX = 6;

export function resolveQuickReplyIdentity(
  account: Pick<EmailAccount, "name" | "providerLabel" | "email"> | undefined,
  lang: LanguageCode,
): QuickReplyIdentity {
  const defaultAccount = translateWithLang(
    lang,
    "reader.quickReplyDefaultAccount",
  );
  const rawProvider =
    account?.providerLabel?.trim() || account?.name?.trim() || defaultAccount;
  const providerLabel = localizeBuiltinText(rawProvider, lang);
  const coreEmail =
    account?.email?.trim() || account?.name?.trim() || defaultAccount;

  const prefixText = translateWithLang(lang, "reader.quickReplyViaPrefix", {
    provider: providerLabel,
  });
  const tooltipText = translateWithLang(lang, "reader.quickReplyLockTooltip", {
    provider: providerLabel,
    email: coreEmail,
  });

  return {
    providerLabel,
    coreEmail,
    prefixText,
    tooltipText,
    collapsedAccountText: coreEmail,
  };
}

export function evaluateQuickReplyPillStage(
  metrics: QuickReplyWidthMetrics,
  prevStage?: QuickReplyPillStage,
): QuickReplyPillLayout {
  const minTitle = metrics.minTitleWidth ?? DEFAULT_MIN_TITLE_WIDTH;
  const headerGap = metrics.headerGap ?? DEFAULT_HEADER_GAP;
  const collapseW = metrics.collapseBtnWidth ?? 0;
  const rightGap =
    collapseW > 0 ? (metrics.rightGroupGap ?? DEFAULT_RIGHT_GAP) : 0;

  if (metrics.headerWidth <= 0 || metrics.fullPillWidth <= 0) {
    return { stage: "full", hidePrefix: false, emailTruncated: false };
  }

  // 左侧标题至少保留 minTitle（若标题本身更短则按实际宽度），其余全部让给右侧锁定胶囊
  const reservedLeft = Math.max(
    minTitle,
    Math.min(metrics.titleNaturalWidth, 168),
  );
  const availableForPill =
    metrics.headerWidth - reservedLeft - headerGap - collapseW - rightGap;

  // 若上一帧已处于去前缀态，增加 6px 迟滞余量，彻底杜绝临界点附近来回闪烁
  const fullThreshold =
    prevStage && prevStage !== "full"
      ? metrics.fullPillWidth + HYSTERESIS_PX
      : metrics.fullPillWidth;

  if (availableForPill >= fullThreshold) {
    return { stage: "full", hidePrefix: false, emailTruncated: false };
  }
  if (availableForPill >= metrics.emailOnlyPillWidth) {
    return { stage: "email-only", hidePrefix: true, emailTruncated: false };
  }
  return { stage: "ellipsis", hidePrefix: true, emailTruncated: true };
}

export function useQuickReplyPillLayout(
  headerRef: RefObject<HTMLDivElement | null>,
  measureHostRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  depsKey: string,
): QuickReplyPillStage {
  const [stage, setStage] = useState<QuickReplyPillStage>("full");

  useLayoutEffect(() => {
    const headerEl = headerRef.current;
    if (!enabled || !headerEl) return;

    const recompute = () => {
      const hostEl = measureHostRef.current;
      const headerWidth = headerEl.clientWidth;
      const titleEl = hostEl?.querySelector<HTMLElement>(
        '[data-measure="title"]',
      );
      const fullEl = hostEl?.querySelector<HTMLElement>(
        '[data-measure="full"]',
      );
      const emailEl = hostEl?.querySelector<HTMLElement>(
        '[data-measure="email"]',
      );
      const collapseEl = headerEl.querySelector<HTMLElement>(
        "[data-quick-reply-collapse]",
      );

      setStage((prev) => {
        const next = evaluateQuickReplyPillStage(
          {
            headerWidth,
            titleNaturalWidth: titleEl?.offsetWidth ?? 120,
            fullPillWidth: fullEl?.offsetWidth ?? 0,
            emailOnlyPillWidth: emailEl?.offsetWidth ?? 0,
            collapseBtnWidth: collapseEl?.offsetWidth ?? 0,
          },
          prev,
        );
        return next.stage === prev ? prev : next.stage;
      });
    };

    recompute();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(recompute);
    ro.observe(headerEl);
    return () => ro.disconnect();
  }, [headerRef, measureHostRef, enabled, depsKey]);

  return stage;
}
