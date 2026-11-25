import type { ProviderId } from "../types/account.ts";
import type { ProviderLocaleCopy } from "./providerCatalogEnPrimary.ts";

export const EN_PROVIDERS_SECONDARY: Partial<
  Record<ProviderId, ProviderLocaleCopy>
> = {
  nevermail: {
    name: "Naver Mail",
    subtitle: "Naver Mail (@naver.com)",
    domainHint: "naver.com",
    emailPlaceholder: "Enter your full @naver.com email address",
    badgeText: "App Password",
    guideTitle: "Connect Naver Mail (@naver.com)",
    guideSummary:
      "Preconfigured with imap.naver.com:993 and smtp.naver.com:465 TLS endpoints.",
    steps: [
      "Sign in to mail.naver.com → Settings → POP3/IMAP and enable IMAP / SMTP.",
      "Generate an application password under Naver 2-Step Verification.",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
    note: "SMTP supports both 465 SSL/TLS and 587 STARTTLS.",
  },
  yandex: {
    name: "Yandex Mail",
    subtitle: "Yandex ID · App Password",
    domainHint: "yandex.com / yandex.ru",
    emailPlaceholder: "Enter your full Yandex email address",
    badgeText: "App Password",
    guideTitle: "Yandex Mail · App Password",
    guideSummary:
      "Enable mail client access in Yandex Mail settings and create an app password.",
    steps: [
      "Allow mail client IMAP access in Yandex Mail & Security settings.",
      "Generate a dedicated mail app credential following official Yandex guidance.",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
  },
  icloud: {
    name: "iCloud Mail",
    subtitle: "Apple Account · App-Specific Password",
    domainHint: "icloud.com / Custom Domain",
    emailPlaceholder: "Enter your full iCloud email address",
    badgeText: "App Password",
    guideTitle: "iCloud Mail · App-Specific Password",
    guideSummary:
      "Requires Apple two-factor authentication and a dedicated App-Specific Password.",
    steps: [
      "Confirm two-factor authentication and iCloud Mail are active on your Apple Account.",
      "Generate an App-Specific Password in Apple Account Security — do not enter your Apple password.",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
  },
  yahoo: {
    name: "Yahoo Mail",
    subtitle: "Yahoo Account · App Password",
    domainHint: "yahoo.com / Yahoo Account",
    emailPlaceholder: "Enter your full Yahoo email address",
    badgeText: "App Password",
    guideTitle: "Yahoo Mail · App Password",
    guideSummary:
      "Desktop IMAP access requires an app password generated in Yahoo Account Security.",
    steps: [
      "Check third-party mail client access options in Yahoo Account Security.",
      "Generate a mail app password per Yahoo's official security instructions.",
      "Return here to enter your email and dedicated credential, then test incoming and outgoing mail.",
    ],
  },
};
