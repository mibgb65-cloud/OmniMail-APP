const TRUSTED_STORAGE_PREFIX = "omnimail.trustedLinkDomains.";

export function normalizeHostname(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

export function isIpAddressHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
  if (hostname.includes(":")) return true;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function getStorageKey(profileId: string): string {
  return `${TRUSTED_STORAGE_PREFIX}${profileId.trim() || "default"}`;
}

function writeTrustedDomains(profileId: string, domains: string[]): string[] {
  const unique = [...new Set(domains.map(normalizeHostname).filter(Boolean))];
  try {
    if (typeof localStorage !== "undefined") {
      if (unique.length === 0)
        localStorage.removeItem(getStorageKey(profileId));
      else
        localStorage.setItem(getStorageKey(profileId), JSON.stringify(unique));
    }
  } catch {
    // 忽略受限环境下的本地存储异常
  }
  return unique;
}

export function listTrustedDomains(profileId: string): string[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(getStorageKey(profileId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .filter((item): item is string => typeof item === "string")
          .map(normalizeHostname)
          .filter(Boolean),
      ),
    ];
  } catch {
    return [];
  }
}

export function isDomainTrusted(profileId: string, hostname: string): boolean {
  const clean = normalizeHostname(hostname);
  return Boolean(clean) && listTrustedDomains(profileId).includes(clean);
}

export function trustDomain(profileId: string, hostname: string): string[] {
  const clean = normalizeHostname(hostname);
  if (!clean || isIpAddressHost(clean) || clean.includes("xn--")) {
    return listTrustedDomains(profileId);
  }
  return writeTrustedDomains(profileId, [
    ...listTrustedDomains(profileId),
    clean,
  ]);
}

export function removeTrustedDomain(
  profileId: string,
  hostname: string,
): string[] {
  const clean = normalizeHostname(hostname);
  return writeTrustedDomains(
    profileId,
    listTrustedDomains(profileId).filter((item) => item !== clean),
  );
}

export function clearTrustedDomains(profileId: string): void {
  writeTrustedDomains(profileId, []);
}
