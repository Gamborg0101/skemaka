/**
 * Self-hosted cookie-consent state — no third-party CMP script (which would
 * itself be a tracking surface). EU/Danish cookie rules: strictly necessary
 * cookies (auth/session/CSRF, this consent cookie) never require consent;
 * everything else is gated on the categories below.
 *
 * Skemaka currently sets NO analytics or marketing cookies — the "analytics"
 * category exists so that if analytics are ever added, they must check
 * hasConsent("analytics") first and default to off.
 */

export const CONSENT_COOKIE = "skemaka_cookie_consent"
/** Bump when categories change materially — old consents become invalid and the banner re-appears. */
export const CONSENT_VERSION = 1
/** Danish practice: renew consent at least every 12 months. */
const CONSENT_MAX_AGE_DAYS = 365

export type ConsentCategory = "necessary" | "preferences" | "analytics"

export interface CookieConsent {
  version: number
  /** Always true — session/auth/CSRF and the consent cookie itself. */
  necessary: true
  /** Remembering choices like language (NEXT_LOCALE). */
  preferences: boolean
  /** Reserved: no analytics cookies exist today; anything added later must check this. */
  analytics: boolean
  /** ISO timestamp of the choice, for renewal + proof of consent. */
  decidedAt: string
}

/** Fired on window whenever consent changes (same-tab listeners re-read state). */
export const CONSENT_CHANGED_EVENT = "skemaka:cookie-consent-changed"
/** Fired on window to re-open the banner in settings mode (e.g. footer link). */
export const CONSENT_OPEN_SETTINGS_EVENT = "skemaka:cookie-settings-open"

export function readConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1)
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<CookieConsent>
    if (parsed.version !== CONSENT_VERSION) return null
    return {
      version: CONSENT_VERSION,
      necessary: true,
      preferences: parsed.preferences === true,
      analytics: parsed.analytics === true,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function writeConsent(choice: { preferences: boolean; analytics: boolean }): CookieConsent {
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    necessary: true,
    preferences: choice.preferences,
    analytics: choice.analytics,
    decidedAt: new Date().toISOString(),
  }
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; path=/; max-age=${maxAge}; SameSite=Lax`
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT))
  return consent
}

/**
 * Gate for any non-essential cookie or script. Necessary is always allowed;
 * anything else requires an explicit stored opt-in.
 */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === "necessary") return true
  const consent = readConsent()
  return consent ? consent[category] : false
}
