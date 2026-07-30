/**
 * Guards the public pricing maths against the Stripe price it must mirror.
 *
 * Billing subscribes with `quantity = activeSeatCount` against a single
 * VOLUME-tiered Stripe price:
 *   - tier 1 (up to 5 units): flat €19.00 (1900)
 *   - tier 2 (6+ units):      €3.50 (350) per unit, applied to ALL units
 *
 * Volume tiers charge the whole quantity at the matched tier's rate, so Stripe's
 * total is exactly `max(19, units × 3.5)`. If these tests fail, the marketing
 * site and the invoice have diverged — fix Stripe and the constants together, in
 * the same commit.
 */
import { describe, it, expect } from "vitest"
import {
  PRICE_PER_EMPLOYEE_MONTHLY,
  MONTHLY_MINIMUM,
  MINIMUM_COVERS_STAFF,
  monthlyTotal,
  formatPrice,
} from "@/lib/pricing"

describe("pricing constants", () => {
  // These are the values encoded in the Stripe price. Changing one without
  // changing Stripe silently mis-bills every customer, so pin them explicitly.
  it("matches the configured Stripe tiers", () => {
    expect(MONTHLY_MINIMUM).toBe(19)
    expect(PRICE_PER_EMPLOYEE_MONTHLY).toBe(3.5)
  })

  it("derives the break-even staff count from the two constants", () => {
    expect(MINIMUM_COVERS_STAFF).toBe(5)
    expect(MINIMUM_COVERS_STAFF).toBe(Math.floor(MONTHLY_MINIMUM / PRICE_PER_EMPLOYEE_MONTHLY))
  })
})

describe("monthlyTotal", () => {
  it.each([
    [0, 19],
    [1, 19],
    [5, 19],
    [6, 21],
    [20, 70],
  ])("bills %i active staff at €%i", (seats, expected) => {
    expect(monthlyTotal(seats)).toBe(expected)
  })

  it("floors at the minimum for every count the minimum covers", () => {
    for (let n = 0; n <= MINIMUM_COVERS_STAFF; n++) {
      expect(monthlyTotal(n)).toBe(MONTHLY_MINIMUM)
    }
  })

  it("charges per employee for every count above the break-even", () => {
    for (let n = MINIMUM_COVERS_STAFF + 1; n <= 60; n++) {
      expect(monthlyTotal(n)).toBeCloseTo(n * PRICE_PER_EMPLOYEE_MONTHLY, 10)
    }
  })

  it("crosses over exactly once, between MINIMUM_COVERS_STAFF and the next seat", () => {
    expect(monthlyTotal(MINIMUM_COVERS_STAFF)).toBe(MONTHLY_MINIMUM)
    expect(monthlyTotal(MINIMUM_COVERS_STAFF + 1)).toBeGreaterThan(MONTHLY_MINIMUM)
  })

  it("never bills below the minimum, including for negative input", () => {
    expect(monthlyTotal(-5)).toBe(MONTHLY_MINIMUM)
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
    expect(formatPrice(24.5)).toBe("24.50")
  })
})
