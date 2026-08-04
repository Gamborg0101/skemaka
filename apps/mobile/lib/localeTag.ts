import { LOCALE_TAGS, DEFAULT_LOCALE, type Locale } from "@skemaka/i18n"

/**
 * Module-level singleton for the BCP-47 tag used by date/time formatting,
 * mirroring lib/timeFormat.ts and the web app's lib/orgSettings pattern.
 *
 * Date helpers in lib/dates.ts and lib/utils.ts are plain functions called from
 * everywhere, including outside React, so they cannot read a context. They used
 * to hardcode "en-GB", which meant a fully translated Danish screen still said
 * "Monday 27" and "Mon 27 Jul – Sun 2 Aug". CLAUDE.md calls this out for the web
 * app; the same rule applies here.
 *
 * Safe as a singleton because the device language cannot change without
 * restarting the app, so this is written once at startup and never races.
 */
let _tag: string = LOCALE_TAGS[DEFAULT_LOCALE]

export function setLocaleTag(locale: Locale): void {
  _tag = LOCALE_TAGS[locale]
}

export function getLocaleTag(): string {
  return _tag
}
