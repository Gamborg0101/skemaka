// Module-level singleton for the org's clock format, mirroring the web app's
// lib/orgSettings pattern. Set once when the current user / org loads (see
// hooks/useEmployee.ts) and read by formatTime() in lib/utils.ts so call sites
// don't each need to thread the preference through. Defaults to "24h" (EU) so
// times render EU-correct before the org settings have loaded.

export type TimeFormat = "12h" | "24h"

let _timeFormat: TimeFormat = "24h"

export function setTimeFormat(format: TimeFormat): void {
  _timeFormat = format
}

export function getTimeFormat(): TimeFormat {
  return _timeFormat
}
