import type {
  ProviderCatalogItem,
  ProviderCategory,
  ProviderId,
} from "../types/account.ts";
import { PROVIDERS_AGENT } from "./providersAgent.ts";
import { PROVIDERS_PRIMARY } from "./providersPrimary.ts";
import { PROVIDERS_SECONDARY } from "./providersSecondary.ts";

export { PROVIDERS_AGENT };

export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  ...PROVIDERS_PRIMARY,
  ...PROVIDERS_SECONDARY,
];

export const ALL_PROVIDER_PRESETS: ProviderCatalogItem[] = [
  ...PROVIDERS_AGENT,
  ...PROVIDER_CATALOG,
];

export function resolveProviderCategory(
  item: Pick<ProviderCatalogItem, "category">,
): ProviderCategory {
  return item.category === "agent" ? "agent" : "standard";
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
