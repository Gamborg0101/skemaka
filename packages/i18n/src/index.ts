/**
 * @skemaka/i18n — shared message catalogs for web and (later) mobile.
 *
 * Messages are namespaced JSON files under `messages/<locale>/`. English is
 * the source language; every other locale must mirror its key set exactly
 * (enforced by the catalog-parity test in apps/web).
 */

import type { Locale } from "./locales"

import enAuth from "./messages/en/auth.json"
import enCommon from "./messages/en/common.json"
import enDialogs from "./messages/en/dialogs.json"
import enEmails from "./messages/en/emails.json"
import enManager from "./messages/en/manager.json"
import enMarketing from "./messages/en/marketing.json"
import enOnboarding from "./messages/en/onboarding.json"
import enPortal from "./messages/en/portal.json"
import enSms from "./messages/en/sms.json"

import daAuth from "./messages/da/auth.json"
import daCommon from "./messages/da/common.json"
import daDialogs from "./messages/da/dialogs.json"
import daEmails from "./messages/da/emails.json"
import daManager from "./messages/da/manager.json"
import daMarketing from "./messages/da/marketing.json"
import daOnboarding from "./messages/da/onboarding.json"
import daPortal from "./messages/da/portal.json"
import daSms from "./messages/da/sms.json"

const en = {
  auth: enAuth,
  common: enCommon,
  dialogs: enDialogs,
  emails: enEmails,
  manager: enManager,
  marketing: enMarketing,
  onboarding: enOnboarding,
  portal: enPortal,
  sms: enSms,
}

/** Shape of one locale's full catalog — English is the source of truth. */
export type Messages = typeof en

const MESSAGES: Record<Locale, Messages> = {
  en,
  da: {
    auth: daAuth,
    common: daCommon,
    dialogs: daDialogs,
    emails: daEmails,
    manager: daManager,
    marketing: daMarketing,
    onboarding: daOnboarding,
    portal: daPortal,
    sms: daSms,
  },
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale]
}

export * from "./locales"
export * from "./quotes"
