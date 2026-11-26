import type { ProviderCatalogItem, ProviderId } from "../types/account.ts";
import type { LanguageCode } from "../types/settings.ts";
import { EN_PROVIDERS_AGENT } from "./providerCatalogEnAgent.ts";
import { EN_PROVIDERS_ENTERPRISE } from "./providerCatalogEnEnterprise.ts";
import {
  EN_PROVIDERS_PRIMARY,
  type ProviderLocaleCopy,
} from "./providerCatalogEnPrimary.ts";
import { EN_PROVIDERS_SECONDARY } from "./providerCatalogEnSecondary.ts";

const EN_PROVIDERS: Partial<Record<ProviderId, ProviderLocaleCopy>> = {
  ...EN_PROVIDERS_AGENT,
  ...EN_PROVIDERS_PRIMARY,
  ...EN_PROVIDERS_SECONDARY,
  ...EN_PROVIDERS_ENTERPRISE,
};

export function localizeProviderPreset(
  item: ProviderCatalogItem,
  lang: LanguageCode,
): ProviderCatalogItem {
  if (lang !== "en-US") return item;
  const copy = EN_PROVIDERS[item.id];
  return copy ? { ...item, ...copy } : item;
}
