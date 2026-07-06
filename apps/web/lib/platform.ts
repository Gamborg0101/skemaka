/**
 * Super-admin ("platform") helpers.
 *
 * The super admin is a single operator, identified purely by their email
 * matching SUPERADMIN_EMAIL. They can view and edit any restaurant (org) via an
 * "acting-as" switch: a cookie names the org they're currently managing. All
 * writes still flow through the normal org-scoped API (`/api/orgs/[orgId]/…`),
 * so editing one restaurant can never touch another — the cookie only decides
 * which org the shared manager UI points at.
 *
 * SECURITY: every capability here is gated on `isSuperadmin(email)`, which is
 * false whenever SUPERADMIN_EMAIL is unset/empty. A forged acting-as cookie is
 * inert for anyone who isn't the super admin.
 */

/** Cookie that names the org the super admin is currently managing. */
export const ACTING_ORG_COOKIE = "skemaka_act_as"

/**
 * True only when `email` is the configured super admin. Returns false when
 * SUPERADMIN_EMAIL is unset or blank, so an unconfigured deploy grants nobody
 * platform powers.
 */
export function isSuperadmin(email: string | null | undefined): boolean {
  const configured = process.env.SUPERADMIN_EMAIL?.trim()
  if (!configured) return false
  return !!email && email.trim().toLowerCase() === configured.toLowerCase()
}

/**
 * The org the super admin is acting as, from the request cookie. Returns null
 * for non-super-admins (the cookie is meaningless without super-admin identity)
 * or when no cookie is set.
 */
export function actingOrgIdFrom(
  email: string | null | undefined,
  cookieValue: string | null | undefined,
): string | null {
  if (!isSuperadmin(email)) return null
  const v = cookieValue?.trim()
  return v ? v : null
}
