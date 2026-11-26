import { resolveProviderCategory } from "../../data/providers.ts";
import type {
  ProviderCatalogItem,
  ProviderCategory,
} from "../../types/account.ts";
import type { OverlayModal } from "../../types/ui.ts";

export type PickerCategoryFilter = "all" | ProviderCategory;

export interface PickerCounts {
  total: number;
  agent: number;
  standard: number;
  enterprise: number;
}

export interface FilteredPickerDirectory {
  matched: ProviderCatalogItem[];
  agentItems: ProviderCatalogItem[];
  standardItems: ProviderCatalogItem[];
  enterpriseItems: ProviderCatalogItem[];
  hasQuery: boolean;
  showCustomBalanceCard: boolean;
  showEnterpriseExtras: boolean;
}

export function countProvidersByCategory(
  items: ProviderCatalogItem[],
): PickerCounts {
  let agent = 0;
  let standard = 0;
  let enterprise = 0;
  for (const item of items) {
    const cat = resolveProviderCategory(item);
    if (cat === "agent") agent += 1;
    else if (cat === "enterprise") enterprise += 1;
    else standard += 1;
  }
  return { total: agent + standard + enterprise, agent, standard, enterprise };
}

function matchesSearchKeyword(
  item: ProviderCatalogItem,
  needle: string,
): boolean {
  if (!needle) return true;
  const cat = resolveProviderCategory(item);
  const catTokens =
    cat === "enterprise"
      ? "enterprise 企业 企业邮箱 公司 域名 mx exmail"
      : cat === "agent"
        ? "agent 智能体 ai"
        : "standard 个人 常规";
  const haystacks = [
    item.id,
    item.name,
    item.subtitle,
    item.domainHint,
    item.badgeText,
    item.defaultImapHost,
    item.defaultSmtpHost,
    catTokens,
  ];
  return haystacks.some((field) => field.toLowerCase().includes(needle));
}

export function filterPickerDirectory(
  items: ProviderCatalogItem[],
  category: PickerCategoryFilter,
  rawQuery: string,
): FilteredPickerDirectory {
  const needle = rawQuery.trim().toLowerCase();
  const hasQuery = needle.length > 0;

  const matched = items.filter((item) => {
    const itemCat = resolveProviderCategory(item);
    if (category !== "all" && itemCat !== category) return false;
    return matchesSearchKeyword(item, needle);
  });

  const agentItems = matched.filter(
    (item) => resolveProviderCategory(item) === "agent",
  );
  const standardItems = matched.filter(
    (item) => resolveProviderCategory(item) === "standard",
  );
  const enterpriseItems = matched.filter(
    (item) => resolveProviderCategory(item) === "enterprise",
  );

  const showCustomBalanceCard =
    !hasQuery &&
    (category === "all" || category === "standard") &&
    standardItems.length > 0 &&
    standardItems.length % 2 === 1;

  const showEnterpriseExtras =
    !hasQuery &&
    (category === "enterprise" ||
      (category === "all" && enterpriseItems.length > 0));

  return {
    matched,
    agentItems,
    standardItems,
    enterpriseItems,
    hasQuery,
    showCustomBalanceCard,
    showEnterpriseExtras,
  };
}

export function resolveProviderTargetOverlay(
  item: Pick<ProviderCatalogItem, "id" | "authMode">,
): OverlayModal {
  if (item.id === "workbuddy") {
    return { type: "workbuddy-connect" };
  }
  if (item.id === "muse") {
    return { type: "muse-connect" };
  }
  if (item.authMode === "oauth") {
    return { type: "oauth-flow", provider: item.id, stage: "waiting" };
  }
  return { type: "provider-guide", provider: item.id };
}

export function isConnectSuiteOverlay(ov: OverlayModal): boolean {
  return (
    ov.type === "add-account" ||
    ov.type === "provider-guide" ||
    ov.type === "oauth-flow" ||
    ov.type === "manual-imap" ||
    ov.type === "muse-connect" ||
    ov.type === "workbuddy-connect"
  );
}

export function resolveConnectSuiteStageKey(ov: OverlayModal): string {
  if (ov.type === "provider-guide" || ov.type === "oauth-flow") {
    return `${ov.type}:${ov.provider}`;
  }
  return ov.type;
}
