import "server-only"

/**
 * Shared Prisma predicates for shift queries.
 *
 * ⚠️ `colorTag: { not: "sick" }` DOES NOT DO WHAT IT LOOKS LIKE.
 *
 * It compiles to `"colorTag" <> 'sick'`, and in SQL that expression evaluates to
 * NULL — not true — for rows where colorTag IS NULL. NULL is not true, so those
 * rows are silently dropped from the result.
 *
 * `colorTag` is nullable (`String?`) and the shift-create API accepts null
 * explicitly, so such rows are reachable. A shift with no colour would vanish
 * from roll-out (never published, so staff never see it), from the pending-
 * rollout badge (so nothing hints it is stuck), and from timesheet export (so
 * its hours never reach payroll) — all without an error anywhere.
 *
 * Verified by experiment: an otherwise-identical draft shift with colorTag NULL
 * produced "No draft shifts to roll out"; setting colorTag to a colour and
 * re-issuing the same request rolled it out.
 *
 * Use {@link NOT_SICK} instead, which matches uncoloured shifts too.
 */
// Deliberately NOT `as const`: Prisma's ShiftWhereInput needs a mutable
// array for OR, and a readonly tuple is not assignable to it.
export const NOT_SICK: { OR: { colorTag: null | { not: string } }[] } = {
  OR: [{ colorTag: null }, { colorTag: { not: "sick" } }],
}
