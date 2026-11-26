import { addAccountPicker } from "./zh/addAccountPicker.ts";
import { common, sidebar, topbar } from "./zh/commonAndShell.ts";
import { compose } from "./zh/compose.ts";
import { composeInlineAi } from "./zh/composeInlineAi.ts";
import { contacts } from "./zh/contacts.ts";
import { externalLink } from "./zh/externalLink.ts";
import { imageLightbox } from "./zh/imageLightbox.ts";
import { labelPopover } from "./zh/labelPopover.ts";
import { mailList, reader, security } from "./zh/mailAndSecurity.ts";
import { mailListBackfill } from "./zh/mailListBackfill.ts";
import { muse, museErrors } from "./zh/museMail.ts";
import { onboarding } from "./zh/onboarding.ts";
import { providerConnect } from "./zh/providerConnect.ts";
import { overlaysPrimary } from "./zh/overlaysPrimary.ts";
import { overlaysSecondary } from "./zh/overlaysSecondary.ts";
import { settingsAdvanced } from "./zh/settingsAdvanced.ts";
import { settingsGeneral } from "./zh/settingsGeneral.ts";
import { syncStatus } from "./zh/syncStatus.ts";
import { errors, toasts } from "./zh/toastsAndErrors.ts";
import { ai, translation } from "./zh/translationAndAi.ts";
import { updater } from "./zh/updater.ts";
import { workbuddy, workbuddyErrors } from "./zh/workBuddy.ts";

export const zhCN = {
  common,
  topbar: {
    ...topbar,
    ...syncStatus,
  },
  sidebar,
  mailList: {
    ...mailList,
    ...mailListBackfill,
  },
  reader,
  security,
  externalLink,
  imageLightbox,
  labels: labelPopover,
  translation,
  ai,
  compose: {
    ...compose,
    ...composeInlineAi,
  },
  contacts,
  settings: {
    ...settingsGeneral,
    ...settingsAdvanced,
  },
  onboarding: {
    ...onboarding,
    ...providerConnect,
    ...addAccountPicker,
  },
  overlays: {
    ...overlaysPrimary,
    ...overlaysSecondary,
  },
  muse,
  workbuddy,
  updater,
  toasts,
  errors: {
    ...errors,
    ...museErrors,
    ...workbuddyErrors,
  },
};

export type Messages = typeof zhCN;
export type MessageDomain = keyof Messages;
export type TranslationKey = {
  [D in MessageDomain]: `${D}.${Extract<keyof Messages[D], string>}`;
}[MessageDomain];
