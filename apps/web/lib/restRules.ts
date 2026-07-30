/**
 * Danish working-time rule checks for the schedule ("spil efter reglerne").
 *
 * Two soft warnings, mirroring the HORESTA/3F hospitality agreements and the
 * Danish working-environment rules:
 *  - REST: at least 11 consecutive hours of rest between two working days
 *    (agreements allow reducing to 8h up to twice a week — we warn below 11
 *    and let the manager decide).
 *  - LONG DAY: a working day of more than 13 hours including breaks.
 *
 * These are advisory, exactly like the time-off/unavailable conflicts: the
 * manager can always schedule anyway. Checks are computed within the loaded
 * week; a Monday shift's rest against the previous week's Sunday is not
 * visible here (accepted limitation, noted in the tooltip copy no further).
 */

import type { Shift } from "@/types"

export const MIN_REST_HOURS = 11
export const MAX_DAY_HOURS = 13

export type RuleWarning =
  | { type: "rest"; hours: number }
  | { type: "longDay"; hours: number }

/** Minutes since local midnight for an "HH:MM" string. */
function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

/**
 * A shift's end as minutes from ITS OWN day's midnight. "00:00"/end-before-
 * start means the shift runs past midnight (e.g. bar 16:00–00:00 → 1440).
 */
function endMinutes(s: { startTime: string; endTime: string }): number {
  const end = minutes(s.endTime)
  return end <= minutes(s.startTime) ? end + 24 * 60 : end
}

function isCountable(s: Shift): boolean {
  return !s.cancelledAt && s.colorTag !== "sick"
}

/** Gross length of a working day in hours, breaks included (the 13h rule counts them). */
export function grossDayHours(s: { startTime: string; endTime: string }): number {
  return (endMinutes(s) - minutes(s.startTime)) / 60
}

/**
 * Rest between the end of `prev` (on prevDate) and the start of `next` (on
 * nextDate), in hours. Dates are YYYY-MM-DD.
 */
export function restHoursBetween(
  prev: { date: string; startTime: string; endTime: string },
  next: { date: string; startTime: string; endTime: string },
): number {
  const dayGap = Math.round(
    (Date.parse(next.date + "T00:00:00Z") - Date.parse(prev.date + "T00:00:00Z")) / 86_400_000,
  )
  return (dayGap * 24 * 60 + minutes(next.startTime) - endMinutes(prev)) / 60
}

/**
 * Scan a set of shifts (typically one loaded week) and return a warning per
 * affected `${employeeId}__${date}` cell. A too-short rest is flagged on the
 * SECOND shift (the one that starts too soon); a long day on its own date.
 * When both would apply to a date, the rest warning wins (it's the sharper
 * rule). Sick markers and cancelled shifts never participate.
 */
export function findRuleWarnings(shifts: Shift[]): Map<string, RuleWarning> {
  const warnings = new Map<string, RuleWarning>()

  const byEmployee = new Map<string, Shift[]>()
  for (const s of shifts) {
    if (!isCountable(s)) continue
    const list = byEmployee.get(s.employeeId) ?? []
    list.push(s)
    byEmployee.set(s.employeeId, list)
  }

  for (const [employeeId, list] of byEmployee) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    for (const s of list) {
      const hours = grossDayHours(s)
      if (hours > MAX_DAY_HOURS) {
        warnings.set(`${employeeId}__${s.date}`, { type: "longDay", hours: Math.round(hours * 10) / 10 })
      }
    }

    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]
      const next = list[i]
      const rest = restHoursBetween(prev, next)
      // Only adjacent working days are a rest-rule concern; a free day between
      // shifts always satisfies the rule.
      if (rest >= 0 && rest < MIN_REST_HOURS) {
        warnings.set(`${employeeId}__${next.date}`, { type: "rest", hours: Math.round(rest * 10) / 10 })
      }
    }
  }

  return warnings
}
