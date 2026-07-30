/**
 * Public pricing shown on the marketing site.
 *
 * ⚠️ MUST match the Stripe price referenced by STRIPE_PRICE_ID. Billing is per
 * SEAT — the checkout subscribes with `quantity = purchased seats` and re-syncs
 * when seats change (see lib/services/billingService.ts).
 *
 * The model is a base fee that includes the first few seats, plus a flat rate
 * per seat above that:
 *
 *     total = MONTHLY_BASE + max(0, seats - SEATS_INCLUDED) × PRICE_PER_EMPLOYEE_MONTHLY
 *
 * The Stripe price is a GRADUATED-tiered recurring price, which charges each
 * tier separately and so produces exactly that:
 *   - tier 1 (up to 5 units): flat €19.00 (1900), €0 per unit
 *   - tier 2 (6+ units):      €3.50 (350) per unit, charged only on units in
 *                             this tier
 *
 * NOTE the tiering mode matters: VOLUME would re-rate *every* unit at the
 * matched tier (giving `max(19, seats × 3.5)`), which is a different and
 * cheaper model. If you change the Stripe price, change these constants in the
 * same commit — pricing.test.ts pins the arithmetic to catch drift.
 */

/** Flat monthly fee. Always charged; includes the first {@link SEATS_INCLUDED} seats. */
export const MONTHLY_BASE = 19
/** Seats covered by {@link MONTHLY_BASE} before per-seat charges begin. */
export const SEATS_INCLUDED = 5
/** Monthly rate for each seat beyond {@link SEATS_INCLUDED}. */
export const PRICE_PER_EMPLOYEE_MONTHLY = 3.5
export const PLAN_CURRENCY = "€"
export const TRIAL_DAYS = 14

/** Monthly total for a given seat count. */
export function monthlyTotal(seats: number): number {
  const billable = Math.max(0, Math.max(0, seats) - SEATS_INCLUDED)
  return MONTHLY_BASE + billable * PRICE_PER_EMPLOYEE_MONTHLY
}

/**
 * Format a euro amount for display: whole numbers stay clean (19 → "19"),
 * fractional amounts show two decimals (3.5 → "3.50", 22.5 → "22.50").
 */
export function formatPrice(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

// ── Marketing ROI estimates ─────────────────────────────────────────────────
// These are illustrative, clearly-labelled estimates used ONLY on the marketing
// site to make the "saves time and money" claim concrete. They are not billing
// figures — keep them conservative and defensible.

/** Typical minutes spent building the week the old way (spreadsheet + chat). */
export const MANUAL_SCHEDULING_MINUTES = 120
/** Typical minutes to build the week in Skemaka. */
export const SKEMAKA_SCHEDULING_MINUTES = 20

const WEEKS_PER_MONTH = 52 / 12

/** Estimated scheduling hours saved per month (manager's own time). */
export function hoursSavedPerMonth(): number {
  const savedPerWeek = MANUAL_SCHEDULING_MINUTES - SKEMAKA_SCHEDULING_MINUTES
  return Math.round((savedPerWeek * WEEKS_PER_MONTH) / 60)
}
