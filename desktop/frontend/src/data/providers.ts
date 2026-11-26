import type {
  ProviderCatalogItem,
  ProviderCategory,
  ProviderId,
} from "../types/account.ts";
import { PROVIDERS_AGENT } from "./providersAgent.ts";
import { PROVIDERS_ENTERPRISE } from "./providersEnterprise.ts";
import { PROVIDERS_PRIMARY } from "./providersPrimary.ts";
import { PROVIDERS_SECONDARY } from "./providersSecondary.ts";

export { PROVIDERS_AGENT, PROVIDERS_ENTERPRISE };

const ENTERPRISE_ID_SET = new Set<ProviderId>(
  PROVIDERS_ENTERPRISE.map((item) => item.id),
);

export const STANDARD_PROVIDER_CATALOG: ProviderCatalogItem[] = [
  ...PROVIDERS_PRIMARY,
  ...PROVIDERS_SECONDARY,
];

export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  ...STANDARD_PROVIDER_CATALOG,
  ...PROVIDERS_ENTERPRISE,
];

export const ALL_PROVIDER_PRESETS: ProviderCatalogItem[] = [
  ...PROVIDERS_AGENT,
  ...PROVIDER_CATALOG,
];

export function isEnterpriseProviderId(id: string): boolean {
  return ENTERPRISE_ID_SET.has(id as ProviderId);
}

export function resolveProviderCategory(
  item: Pick<ProviderCatalogItem, "id" | "category">,
): ProviderCategory {
  if (item.category === "agent") return "agent";
  if (item.category === "enterprise" || ENTERPRISE_ID_SET.has(item.id)) {
    return "enterprise";
  }
  return "standard";
}

export function mergePickerPresets(
  standardPresets: ProviderCatalogItem[],
  agentPresets: ProviderCatalogItem[] = PROVIDERS_AGENT,
): ProviderCatalogItem[] {
  const seen = new Set<ProviderId>();
  const merged: ProviderCatalogItem[] = [];
  for (const item of [...agentPresets, ...standardPresets]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export function findProviderCatalogItem(id: ProviderId): ProviderCatalogItem {
  return (
    ALL_PROVIDER_PRESETS.find((item) => item.id === id) ?? PROVIDER_CATALOG[0]
  );
}
