import type { ProviderCatalogItem, ProviderId } from "../types/account.ts";
import { PROVIDERS_PRIMARY } from "./providersPrimary.ts";
import { PROVIDERS_SECONDARY } from "./providersSecondary.ts";

export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  ...PROVIDERS_PRIMARY,
  ...PROVIDERS_SECONDARY,
];

export function findProviderCatalogItem(id: ProviderId): ProviderCatalogItem {
  return PROVIDER_CATALOG.find((item) => item.id === id) ?? PROVIDER_CATALOG[0];
}
