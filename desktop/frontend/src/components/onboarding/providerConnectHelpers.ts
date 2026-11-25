import type { TranslationKey } from "../../i18n/index.ts";
import type { ProviderId } from "../../types/account.ts";

export function resolveSecretLabelKey(provider: ProviderId): TranslationKey {
  if (provider === "qq" || provider === "netease") {
    return "onboarding.secretLabelAuthCode";
  }
  if (provider === "linuxdo") {
    return "onboarding.secretLabelClientToken";
  }
  return "onboarding.secretLabelAppPassword";
}

export function resolveAccountName(
  customName: string,
  providerName: string,
  email: string,
): string {
  const trimmed = customName.trim();
  if (trimmed) return trimmed;
  const emailPrefix = email.trim().split("@")[0] || email.trim();
  return `${providerName} · ${emailPrefix}`;
}
