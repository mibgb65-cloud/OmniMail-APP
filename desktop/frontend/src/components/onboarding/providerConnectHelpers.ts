import type { TranslationKey } from "../../i18n/index.ts";
import type { ProviderId } from "../../types/account.ts";
import type { LanguageCode } from "../../types/settings.ts";
import {
  ACCOUNT_NAME_MAX_LEN,
  extractEmailDomain,
  resolveConciseProviderLabel,
} from "../../utils/accountDisplay.ts";

export function resolveSecretLabelKey(provider: ProviderId): TranslationKey {
  if (
    provider === "qq" ||
    provider === "netease" ||
    provider === "netease_exmail"
  ) {
    return "onboarding.secretLabelAuthCode";
  }
  if (provider === "linuxdo") {
    return "onboarding.secretLabelClientToken";
  }
  if (provider === "aliyun_exmail" || provider === "mail263") {
    return "onboarding.secretLabelSecurityPwd";
  }
  if (provider === "tencent_exmail" || provider === "feishu") {
    return "onboarding.secretLabelClientPassword";
  }
  return "onboarding.secretLabelAppPassword";
}

export function resolveAccountName(
  customName: string,
  providerOrName: string,
  email: string,
  lang: LanguageCode = "zh-CN",
): string {
  const trimmed = customName.trim().slice(0, ACCOUNT_NAME_MAX_LEN);
  if (trimmed) return trimmed;

  const norm = providerOrName.trim().toLowerCase();
  if (
    norm === "imap" ||
    norm === "标准 imap / smtp" ||
    norm === "通用 imap / smtp" ||
    norm === "standard imap / smtp"
  ) {
    return extractEmailDomain(email) || "IMAP";
  }

  const byNameMap: Record<string, ProviderId> = {
    gmail: "gmail",
    outlook: "outlook",
    "outlook / microsoft 365": "outlook",
    "qq 邮箱": "qq",
    "qq mail": "qq",
    网易邮箱: "netease",
    "netease mail": "netease",
    "linux do 邮箱": "linuxdo",
    "linux do mail": "linuxdo",
    "icloud mail": "icloud",
    "icloud 邮件": "icloud",
    "yahoo mail": "yahoo",
    "naver mail": "nevermail",
    "yandex mail": "yandex",
    腾讯企业邮: "tencent_exmail",
    "tencent exmail": "tencent_exmail",
    阿里企业邮: "aliyun_exmail",
    "alibaba mail": "aliyun_exmail",
    网易企业邮: "netease_exmail",
    "netease exmail": "netease_exmail",
    飞书: "feishu",
    "飞书 / lark": "feishu",
    "feishu / lark": "feishu",
    "263 企业邮": "mail263",
    "263 enterprise mail": "mail263",
    "zoho workplace": "zoho_exmail",
  };

  const pid = (byNameMap[norm] ?? norm) as ProviderId;
  return resolveConciseProviderLabel(pid, email, lang);
}
