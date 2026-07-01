/**
 * Public pricing shown on the marketing site.
 *
 * ⚠️ MUST match the Stripe price referenced by STRIPE_PRICE_ID. Billing is PER
 * ACTIVE EMPLOYEE with a monthly minimum — the checkout subscribes with
 * `quantity = activeSeatCount` and re-syncs on every employee change
 * (see lib/services/billingService.ts).
 *
 * The Stripe price is a VOLUME-tiered recurring price that encodes the floor:
 *   - tier 1 (up to 5 units): flat €19.00 (1900)
 *   - tier 2 (6+ units):      €3.50 (350) per unit, applied to ALL units
 * Volume tiers charge the whole quantity at the matched tier's rate, so the
 * total is exactly `max(19, units × 3.5)` — matching {@link monthlyTotal}.
 * If you change the Stripe price, change these constants in the same commit.
 */
export const PRICE_PER_EMPLOYEE_MONTHLY = 3.5
export const MONTHLY_MINIMUM = 19
export const PLAN_CURRENCY = "€"
export const TRIAL_DAYS = 14

/** Monthly total for a given active-employee count (floored at the minimum). */
export function monthlyTotal(activeEmployees: number): number {
  return Math.max(MONTHLY_MINIMUM, Math.max(0, activeEmployees) * PRICE_PER_EMPLOYEE_MONTHLY)
}

/**
 * Format a euro amount for display: whole numbers stay clean (19 → "19"),
 * fractional amounts show two decimals (3.5 → "3.50", 52.5 → "52.50").
 */
export function formatPrice(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}
