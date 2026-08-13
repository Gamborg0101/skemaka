/**
 * Split shifts are normal in hospitality — a chef on lunch and again on dinner.
 * The rota rule is "no overlapping shifts", not "one shift per day", and the
 * awkward part is that a shift can end on the following calendar day.
 */
import { describe, it, expect } from "vitest"
import { shiftInterval, shiftsOverlap, findOverlappingShift } from "@/lib/dateUtils"

const shift = (date: string, startTime: string, endTime: string) => ({ date, startTime, endTime })

describe("findOverlappingShift", () => {
  it("allows a split shift on the same day", () => {
    const lunch = shift("2026-08-10", "11:00", "14:00")
    const dinner = shift("2026-08-10", "18:00", "23:00")
    expect(findOverlappingShift(dinner, [lunch])).toBeNull()
  })

  it("rejects a genuine overlap on the same day", () => {
    const lunch = shift("2026-08-10", "11:00", "14:00")
    const clash = shift("2026-08-10", "13:00", "17:00")
    expect(findOverlappingShift(clash, [lunch])).toEqual(lunch)
  })

  it("treats back-to-back shifts as fine", () => {
    // Ends 14:00, next starts 14:00 — half-open interval, no overlap.
    const a = shift("2026-08-10", "11:00", "14:00")
    const b = shift("2026-08-10", "14:00", "18:00")
    expect(findOverlappingShift(b, [a])).toBeNull()
  })

  it("catches an overnight shift clashing with the NEXT day's early shift", () => {
    // Filed under Monday but really runs to Tuesday 02:00.
    const overnight = shift("2026-08-10", "22:00", "02:00")
    const nextMorning = shift("2026-08-11", "00:00", "06:00")
    expect(findOverlappingShift(nextMorning, [overnight])).toEqual(overnight)
  })

  it("allows an overnight shift followed by a later shift the next day", () => {
    const overnight = shift("2026-08-10", "22:00", "02:00")
    const nextEvening = shift("2026-08-11", "18:00", "23:00")
    expect(findOverlappingShift(nextEvening, [overnight])).toBeNull()
  })

  it("does not confuse an early shift with a same-day overnight one", () => {
    // Monday 01:00–05:00 and Monday 23:00–07:00 do not overlap in real time.
    const early = shift("2026-08-10", "01:00", "05:00")
    const late = shift("2026-08-10", "23:00", "07:00")
    expect(findOverlappingShift(late, [early])).toBeNull()
  })

  it("returns null against an empty roster", () => {
    expect(findOverlappingShift(shift("2026-08-10", "09:00", "17:00"), [])).toBeNull()
  })

  it("scans every candidate, not just the first", () => {
    const a = shift("2026-08-10", "08:00", "10:00")
    const b = shift("2026-08-10", "16:00", "20:00")
    expect(findOverlappingShift(shift("2026-08-10", "17:00", "18:00"), [a, b])).toEqual(b)
  })
})

describe("shiftInterval", () => {
  it("extends past midnight when the end time is earlier than the start", () => {
    const i = shiftInterval("2026-08-10", "22:00", "02:00")
    expect(i.end - i.start).toBe(4 * 60)
  })

  it("orders days on one absolute timeline", () => {
    const mon = shiftInterval("2026-08-10", "09:00", "17:00")
    const tue = shiftInterval("2026-08-11", "09:00", "17:00")
    expect(tue.start - mon.start).toBe(1440)
    expect(shiftsOverlap(mon, tue)).toBe(false)
  })
})
