/**
 * Guards the public pricing maths against the Stripe price it must mirror.
 *
 * Billing subscribes with `quantity = purchased seats` against a single
 * GRADUATED-tiered Stripe price:
 *   - tier 1 (up to 5 units): flat €19.00 (1900), €0 per unit
 *   - tier 2 (6+ units):      €3.50 (350) per unit, charged only on units in
 *                             this tier
 *
 * Graduated charges each tier separately, so Stripe's total is exactly
 * `19 + max(0, seats - 5) × 3.50`.
 *
 * ⚠️ If the Stripe price is ever switched to VOLUME, every unit is re-rated at
 * the matched tier and the total becomes `max(19, seats × 3.5)` — cheaper above
 * 5 seats, and silently wrong. The boundary assertions below are what catch it:
 * at 6 seats, graduated gives €22.50 and volume gives €21.00.
 */
import { describe, it, expect } from "vitest"
import {
  PRICE_PER_EMPLOYEE_MONTHLY,
  MONTHLY_BASE,
  SEATS_INCLUDED,
  monthlyTotal,
  formatPrice,
} from "@/lib/pricing"

describe("pricing constants", () => {
  // These are the values encoded in the Stripe price. Changing one without
  // changing Stripe silently mis-bills every customer, so pin them explicitly.
  it("matches the configured Stripe tiers", () => {
    expect(MONTHLY_BASE).toBe(19)
    expect(SEATS_INCLUDED).toBe(5)
    expect(PRICE_PER_EMPLOYEE_MONTHLY).toBe(3.5)
  })
})

describe("monthlyTotal", () => {
  it.each([
    [0, 19],
    [1, 19],
    [5, 19],
    [6, 22.5],
    [7, 26],
    [12, 43.5],
    [20, 71.5],
    [60, 211.5],
  ])("bills %i seats at €%s", (seats, expected) => {
    expect(monthlyTotal(seats)).toBeCloseTo(expected, 10)
  })

  it("charges only the base for every seat the base includes", () => {
    for (let n = 0; n <= SEATS_INCLUDED; n++) {
      expect(monthlyTotal(n)).toBe(MONTHLY_BASE)
    }
  })

  it("adds exactly the per-seat rate for each seat above the included count", () => {
    for (let n = SEATS_INCLUDED + 1; n <= 60; n++) {
      const extra = n - SEATS_INCLUDED
      expect(monthlyTotal(n)).toBeCloseTo(MONTHLY_BASE + extra * PRICE_PER_EMPLOYEE_MONTHLY, 10)
    }
  })

  it("has a CONSTANT marginal cost above the included seats", () => {
    // This is the property that distinguishes graduated from volume tiering.
    // Under volume the 6th seat would cost €2.00 and the 7th €3.50; under
    // graduated every seat past the 5th costs exactly the per-seat rate.
    for (let n = SEATS_INCLUDED + 1; n <= 30; n++) {
      expect(monthlyTotal(n) - monthlyTotal(n - 1)).toBeCloseTo(PRICE_PER_EMPLOYEE_MONTHLY, 10)
    }
  })

  it("steps by the per-seat rate at the boundary, not by re-rating every seat", () => {
    // Volume tiering would make this €21.00. Graduated makes it €22.50.
    expect(monthlyTotal(SEATS_INCLUDED)).toBe(19)
    expect(monthlyTotal(SEATS_INCLUDED + 1)).toBeCloseTo(22.5, 10)
    expect(monthlyTotal(SEATS_INCLUDED + 1)).not.toBe(21)
  })

  it("never bills below the base, including for negative input", () => {
    expect(monthlyTotal(-5)).toBe(MONTHLY_BASE)
    expect(monthlyTotal(0)).toBe(MONTHLY_BASE)
  })

  it("is monotonically non-decreasing in seat count", () => {
    for (let n = 1; n <= 60; n++) {
      expect(monthlyTotal(n)).toBeGreaterThanOrEqual(monthlyTotal(n - 1))
    }
  })
})

describe("formatPrice", () => {
  it("keeps whole numbers clean and shows cents otherwise", () => {
    expect(formatPrice(19)).toBe("19")
    expect(formatPrice(3.5)).toBe("3.50")
    expect(formatPrice(22.5)).toBe("22.50")
  })
})
