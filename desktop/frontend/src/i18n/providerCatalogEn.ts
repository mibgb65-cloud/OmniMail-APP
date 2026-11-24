import type { ProviderCatalogItem, ProviderId } from "../types/account.ts";
import type { LanguageCode } from "../types/settings.ts";

type ProviderLocaleCopy = Pick<
  ProviderCatalogItem,
  "name" | "subtitle" | "badgeText" | "guideTitle" | "guideSummary" | "steps"
> & { note?: string };

const EN_PROVIDERS: Partial<Record<ProviderId, ProviderLocaleCopy>> = {
  gmail: {
    name: "Gmail",
    subtitle: "Google Account · Browser OAuth",
    badgeText: "OAuth",
    guideTitle: "Gmail · Browser OAuth",
    guideSummary:
      "Sign in via Google in your default browser without storing your web password.",
    steps: [
      "Open the Google authorization page in your default browser",
      "Choose your Google account and grant mail sync permissions",
      "Return to OmniMail automatically to start initial sync",
    ],
  },
  outlook: {
    name: "Outlook",
    subtitle: "Microsoft 365 / Hotmail · Browser OAuth",
    badgeText: "OAuth",
    guideTitle: "Outlook · Browser OAuth 2.0",
    guideSummary:
      "Sign in with PKCE on Microsoft's official portal without exposing your password.",
    steps: [
      "Sign in to Microsoft / Outlook in your browser and confirm mail scopes",
      "Or connect with an App Password if enabled on your account",
      "Tokens are encrypted into local workspace secrets.vault",
    ],
  },
  qq: {
    name: "QQ Mail",
    subtitle: "QQ / Foxmail · IMAP & Authorization Code",
    badgeText: "Auth Code",
    guideTitle: "QQ Mail · Authorization Code",
    guideSummary:
      "QQ Mail requires a 16-character IMAP/SMTP authorization code instead of your QQ password.",
    steps: [
      "Open QQ Mail web → Settings → Account → POP3/IMAP/SMTP",
      "Enable IMAP/SMTP service and generate a 16-character authorization code",
      "Enter your email address and code below to save encrypted in local vault",
    ],
  },
  netease: {
    name: "NetEase Mail",
    subtitle: "163.com / 126.com · Auto-matched by domain",
    badgeText: "163 / 126",
    guideTitle: "NetEase Mail (163 / 126) · Auth Code",
    guideSummary:
      "Automatically matches IMAP/SMTP hosts for @163.com, @126.com, or @yeah.net.",
    steps: [
      "Sign in to NetEase Mail web → Settings → POP3/SMTP/IMAP",
      "Enable IMAP/SMTP and create a client authorization password",
      "Enter your full address and authorization code below",
    ],
  },
  linuxdo: {
    name: "Linux Do Mail",
    subtitle: "linux.do · Dedicated Client Token",
    badgeText: "Token",
    guideTitle: "Linux Do · Dedicated Client Token",
    guideSummary:
      "Connect over TLS using a client access token issued from the community mail portal.",
    steps: [
      "Open the Linux Do mail console → Security & Client Access",
      "Generate a dedicated desktop client token and copy it",
      "Enter your email and token below to verify and connect",
    ],
  },
  nevermail: {
    name: "Naver Mail",
    subtitle: "Naver Mail (@naver.com)",
    badgeText: "App Password",
    guideTitle: "Connect Naver Mail (@naver.com)",
    guideSummary:
      "Preconfigured with imap.naver.com:993 and smtp.naver.com:465 TLS endpoints.",
    steps: [
      "Sign in to mail.naver.com → Settings → POP3/IMAP and enable IMAP/SMTP",
      "Generate an application password under Naver 2-Step Verification",
      "Enter your @naver.com address and app password to run the 4-step check",
    ],
    note: "SMTP supports both 465 SSL/TLS and 587 STARTTLS.",
  },
  yandex: {
    name: "Yandex Mail",
    subtitle: "Yandex ID · App Password",
    badgeText: "App Password",
    guideTitle: "Yandex Mail · App Password",
    guideSummary:
      "Enable mail client access in Yandex Mail settings and create an app password.",
    steps: [
      "Open Yandex Mail → All Settings → Email Clients and enable IMAP",
      "Create an app password for mail clients in Yandex ID Security",
      "Enter your Yandex address and app password below",
    ],
  },
  icloud: {
    name: "iCloud Mail",
    subtitle: "Apple Account · App-Specific Password",
    badgeText: "App Password",
    guideTitle: "iCloud Mail · App-Specific Password",
    guideSummary:
      "Requires Apple two-factor authentication and a dedicated App-Specific Password.",
    steps: [
      "Open account.apple.com → Sign-In and Security → App-Specific Passwords",
      "Generate a 16-character password labeled “OmniMail”",
      "Enter your @icloud.com or @me.com address and that password below",
    ],
  },
  yahoo: {
    name: "Yahoo Mail",
    subtitle: "Yahoo Account · App Password",
    badgeText: "App Password",
    guideTitle: "Yahoo Mail · App Password",
    guideSummary:
      "Desktop IMAP access requires an app password generated in Yahoo Account Security.",
    steps: [
      "Open Yahoo Account Security and enable 2-Step Verification",
      "Click “Generate app password” for OmniMail",
      "Enter your Yahoo email and app password to verify connection",
    ],
  },
};

export function localizeProviderPreset(
  item: ProviderCatalogItem,
  lang: LanguageCode,
): ProviderCatalogItem {
  if (lang !== "en-US") return item;
  const copy = EN_PROVIDERS[item.id];
  return copy ? { ...item, ...copy } : item;
}
