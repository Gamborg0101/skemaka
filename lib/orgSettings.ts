// Module-level singleton — survives client-side navigation within the session.
// SAFE: only imported by "use client" pages; mutations happen post-hydration in
// the browser, never during SSR. If this module is ever imported from a Server
// Component it will silently share state across all concurrent requests — do not
// do that.
// TODO: replace with real API calls to /api/orgs/[orgId]/settings

export interface DayHours {
  isOpen: boolean
  openTime: string   // "HH:MM"
  closeTime: string  // "HH:MM"
}

export interface OrgSettings {
  hours: DayHours[]  // index 0 = Monday … 6 = Sunday
  defaultScheduleView: "week" | "timeline"
  currency: string   // ISO 4217 code e.g. "EUR", "USD"
}

export const SUPPORTED_CURRENCIES = [
  { code: "EUR", name: "Euro" },
  { code: "USD", name: "US Dollar" },
  { code: "GBP", name: "British Pound" },
  { code: "DKK", name: "Danish Krone" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
]

const DEFAULT_HOURS: DayHours[] = [
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Mon
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Tue
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Wed
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Thu
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Fri
  { isOpen: true,  openTime: "09:00", closeTime: "17:00" }, // Sat
  { isOpen: false, openTime: "09:00", closeTime: "17:00" }, // Sun
]

let _settings: OrgSettings = {
  hours: DEFAULT_HOURS.map((h) => ({ ...h })),
  defaultScheduleView: "week",
  currency: "EUR",
}

export function getOrgSettings(): OrgSettings {
  return {
    hours: _settings.hours.map((h) => ({ ...h })),
    defaultScheduleView: _settings.defaultScheduleView,
    currency: _settings.currency,
  }
}

const CURRENCY_LOCALE: Record<string, string> = {
  EUR: "de-DE",
  USD: "en-US",
  GBP: "en-GB",
  DKK: "da-DK",
  SEK: "sv-SE",
  NOK: "nb-NO",
  CHF: "de-CH",
  AUD: "en-AU",
  CAD: "en-CA",
  JPY: "ja-JP",
}

export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency ?? _settings.currency
  const locale = CURRENCY_LOCALE[cur]
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function getCurrencySymbol(currency?: string): string {
  const cur = currency ?? _settings.currency
  if (!cur) return ""
  const locale = CURRENCY_LOCALE[cur]
  return (
    new Intl.NumberFormat(locale, { style: "currency", currency: cur })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? cur
  )
}

export function updateOrgSettings(patch: Partial<OrgSettings>): void {
  _settings = { ..._settings, ...patch }
}
