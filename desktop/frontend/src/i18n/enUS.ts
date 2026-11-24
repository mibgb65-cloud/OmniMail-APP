import { common, sidebar, topbar } from "./en/commonAndShell.ts";
import { compose } from "./en/compose.ts";
import { contacts } from "./en/contacts.ts";
import { externalLink } from "./en/externalLink.ts";
import { imageLightbox } from "./en/imageLightbox.ts";
import { mailList, reader, security } from "./en/mailAndSecurity.ts";
import { mailListBackfill } from "./en/mailListBackfill.ts";
import { onboarding } from "./en/onboarding.ts";
import { overlaysPrimary } from "./en/overlaysPrimary.ts";
import { overlaysSecondary } from "./en/overlaysSecondary.ts";
import { settingsAdvanced } from "./en/settingsAdvanced.ts";
import { settingsGeneral } from "./en/settingsGeneral.ts";
import { errors, toasts } from "./en/toastsAndErrors.ts";
import { ai, translation } from "./en/translationAndAi.ts";
import type { zhCN } from "./zhCN.ts";

export const enUS = {
  common,
  topbar,
  sidebar,
  mailList: {
    ...mailList,
    ...mailListBackfill,
  },
  reader,
  security,
  externalLink,
  imageLightbox,
  translation,
  ai,
  compose,
  contacts,
  settings: {
    ...settingsGeneral,
    ...settingsAdvanced,
  },
  onboarding,
  overlays: {
    ...overlaysPrimary,
    ...overlaysSecondary,
  },
  toasts,
  errors,
} satisfies typeof zhCN;
