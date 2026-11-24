import { common, sidebar, topbar } from "./zh/commonAndShell.ts";
import { compose } from "./zh/compose.ts";
import { contacts } from "./zh/contacts.ts";
import { mailList, reader, security } from "./zh/mailAndSecurity.ts";
import { onboarding } from "./zh/onboarding.ts";
import { overlaysPrimary } from "./zh/overlaysPrimary.ts";
import { overlaysSecondary } from "./zh/overlaysSecondary.ts";
import { settingsAdvanced } from "./zh/settingsAdvanced.ts";
import { settingsGeneral } from "./zh/settingsGeneral.ts";
import { errors, toasts } from "./zh/toastsAndErrors.ts";
import { ai, translation } from "./zh/translationAndAi.ts";

export const zhCN = {
  common,
  topbar,
  sidebar,
  mailList,
  reader,
  security,
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
};

export type Messages = typeof zhCN;
export type MessageDomain = keyof Messages;
export type TranslationKey = {
  [D in MessageDomain]: `${D}.${Extract<keyof Messages[D], string>}`;
}[MessageDomain];
