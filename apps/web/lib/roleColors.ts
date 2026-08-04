// Single source of truth for job-role colors.
//
// Role colors are stored as short *named tokens* (not hex) because the schedule
// renders them through fixed Tailwind class maps (ShiftCard, ShiftTimeline) that
// key off these names. Any token added here must also get matching entries in
// those maps, and Tailwind must ship the corresponding shade classes.
//
// The swatch hex is only for display (the picker + list dots) — the stored value
// is always the token.

export const ROLE_COLOR_TOKENS = [
  "blue",
  "green",
  "orange",
  "purple",
  "yellow",
  "rose",
  "red",
  "pink",
  "indigo",
  "teal",
  "cyan",
  "gray",
] as const

export type RoleColorToken = (typeof ROLE_COLOR_TOKENS)[number]

/** Representative hex for each token — used to paint swatches in pickers/dots. */
export const ROLE_COLOR_SWATCH: Record<string, string> = {
  blue:   "#3b82f6",
  green:  "#22c55e",
  orange: "#f97316",
  purple: "#a855f7",
  yellow: "#eab308",
  rose:   "#f43f5e",
  red:    "#ef4444",
  pink:   "#ec4899",
  indigo: "#6366f1",
  teal:   "#14b8a6",
  cyan:   "#06b6d4",
  gray:   "#6b7280",
}

/** Hex to paint a role-color dot; falls back to the raw value (covers legacy). */
export function roleColorSwatch(token: string): string {
  return ROLE_COLOR_SWATCH[token] ?? token
}

/**
 * The colour token a scheduled shift should be painted in.
 *
 * Keyed on the SHIFT's job role, not the employee's. A shift can be scheduled
 * under a role other than the person's default — a chef covering the bar — and
 * colouring by the employee made the grid claim the kitchen was staffed on a
 * night nobody was in it. Both the week grid (ShiftCard) and the timeline
 * (ShiftTimeline) resolve colour through here so they can't drift apart.
 *
 * Sick days win over everything: they're an absence, not a role.
 * `employeeJobRole` is the fallback for older shifts stored without a role, and
 * unknown roles land on "gray" rather than rendering an unstyled bar.
 */
export function shiftColorToken(
  shift: { jobRole?: string | null; colorTag?: string | null },
  employeeJobRole: string,
  jobRoles: { name: string; color: string }[],
): string {
  if (shift.colorTag === "sick") return "sick"
  const role = shift.jobRole || employeeJobRole
  return jobRoles.find((r) => r.name === role)?.color ?? "gray"
}
