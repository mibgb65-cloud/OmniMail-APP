export type AuthPillTone =
  "pill-success" | "pill-danger" | "pill-warning" | "pill-neutral";

export function authStatusPillClass(rawStatus: string): AuthPillTone {
  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === "pass") return "pill-success";
  if (normalized === "fail" || normalized === "permerror") return "pill-danger";
  if (normalized === "softfail" || normalized === "temperror")
    return "pill-warning";
  return "pill-neutral";
}

export function formatAuthBadgeValue(rawStatus: string): string {
  const normalized = rawStatus.trim().toLowerCase();
  return normalized || "unknown";
}

const trustedSendersByProfile = new Map<string, Set<string>>();

function normalizeSenderKey(senderEmail: string, fallbackMailId: string) {
  const email = senderEmail.trim().toLowerCase();
  return email ? `sender:${email}` : `mail:${fallbackMailId}`;
}

export function isTrustedSecuritySender(
  profileId: string,
  senderEmail: string,
  fallbackMailId: string,
): boolean {
  const scope = profileId || "default";
  return Boolean(
    trustedSendersByProfile
      .get(scope)
      ?.has(normalizeSenderKey(senderEmail, fallbackMailId)),
  );
}

export function rememberTrustedSecuritySender(
  profileId: string,
  senderEmail: string,
  fallbackMailId: string,
): void {
  const scope = profileId || "default";
  let set = trustedSendersByProfile.get(scope);
  if (!set) {
    set = new Set<string>();
    trustedSendersByProfile.set(scope, set);
  }
  set.add(normalizeSenderKey(senderEmail, fallbackMailId));
}

export function clearTrustedSecuritySenders(profileId?: string): void {
  if (profileId === undefined) {
    trustedSendersByProfile.clear();
    return;
  }
  trustedSendersByProfile.delete(profileId || "default");
}
