import type { ProviderId } from "../types/account.ts";
import type { ProviderLocaleCopy } from "./providerCatalogEnPrimary.ts";

export const EN_PROVIDERS_AGENT: Partial<
  Record<ProviderId, ProviderLocaleCopy>
> = {
  workbuddy: {
    name: "WorkBuddy Agent Mail",
    subtitle: "workbuddy.cn · Tencent Agent Mailbox",
    domainHint: "workbuddy.cn / mail.workbuddy.cn",
    badgeText: "Official Auth",
    guideTitle: "Connect WorkBuddy Mail",
    guideSummary:
      "Authorize in your default browser to verify your Tencent WorkBuddy account and Agent Mail alias.",
    steps: [
      "Confirm Agent Mail is activated on your Tencent WorkBuddy account.",
      "Click 'Authorize in Browser' on the right to sign in and approve access on the official page.",
      "Once authorized, your bound Agent Mail address is detected automatically so you can view messages.",
    ],
  },
  muse: {
    name: "Muse Mail",
    subtitle: "muse.ai · Dedicated Agent Mailbox",
    domainHint: "muse.ai",
    badgeText: "Native Direct",
    guideTitle: "Connect Muse Mail",
    guideSummary:
      "Sign in inside an isolated official window and browse threads over the native encrypted gateway.",
    steps: [
      "Confirm your account has an active @muse.ai email identity.",
      "Click 'Open Muse Login Window' on the right and complete official sign-in.",
      "Click 'Verify & Connect' to confirm your bound identity and start reading.",
    ],
  },
};
