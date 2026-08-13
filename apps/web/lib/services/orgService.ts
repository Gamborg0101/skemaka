import { db } from "@/lib/prisma"
import { PrismaClient, Prisma } from "@/app/generated/prisma/client"
import { serOrg, serJobRole, serShiftTemplate } from "@/lib/serialize"
import { seedDefaultRoles, seedDefaultShiftTemplates } from "@/lib/seedDefaultRoles"
import { recordAudit } from "@/lib/audit"
import type { Organization, JobRole, ShiftTemplate, OrgScheduleSettings, SubscriptionStatus } from "@/types"
import { canAccessOrg, type BillingBlock } from "@/lib/billing"
import { ServiceError } from "./errors"
import { assertSeatAvailable } from "./seats"

// ── Organization ──────────────────────────────────────────────────────────────

const VALID_CURRENCIES = ["EUR", "USD", "GBP", "DKK", "SEK", "NOK"] as const

/** Length of the free trial granted to a new organization. */
export const TRIAL_DAYS = 14

export interface CreateOrgInput {
  name: string
  currency?: string
  country?: string
  timezone?: string
  locale?: string
  industry?: string
  timeFormat?: "12h" | "24h"
  // Identity claims from the caller's JWT. Used to self-heal a missing User row
  // before the membership FK is written (e.g. a session whose User was deleted).
  userEmail?: string | null
  userName?: string | null
}

export async function createOrg(
  userId: string,
  input: CreateOrgInput,
): Promise<Organization> {
  // One org per manager (see project notes). A user who already manages an
  // organisation must not silently end up with a second, orphaned one — e.g. a
  // returning manager whose "already have an org?" check on /onboarding raced
  // a Neon cold start and missed the redirect, or a double-submit. Both
  // lib/auth.ts's JWT mint and getOrgContext below already pick the EARLIEST
  // MANAGER membership as "the" org (orderBy joinedAt asc), so a second org
  // would be permanently unreachable dead weight, not a usable workspace.
  //
  // Hard-erroring here (ServiceError "CONFLICT") was the obvious option, but
  // it would strand the onboarding wizard on step 1 with no way forward for a
  // legitimate retry/race — the user did nothing wrong. Handing back their
  // existing org instead lets the flow continue exactly as if the check had
  // redirected them correctly in the first place.
  //
  // Scoped to MANAGER memberships only: employeeService.claimInvite lets one
  // person legitimately hold an EMPLOYEE membership in a second org (e.g.
  // working two jobs) — that must keep working and is untouched by this guard.
  const existingManagerMembership = await db.membership.findFirst({
    where: { userId, role: "MANAGER" },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  })
  if (existingManagerMembership) return serOrg(existingManagerMembership.organization)

  const { name, currency, country, timezone, locale, industry, timeFormat, userEmail, userName } = input
  const trimmedName     = name.trim()
  const resolvedCurrency = currency && (VALID_CURRENCIES as readonly string[]).includes(currency) ? currency : "EUR"
  const baseSlug        = trimmedName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

  // country / locale / timezone / industry are first-class columns on the org
  // (see schema). timeFormat is a schedule display preference and stays in the
  // settings JSON, where updateOrgSettings + the orgSettings singleton read it.
  const settings: Record<string, string> = {}
  if (timeFormat) settings.timeFormat = timeFormat

  let slug   = baseSlug || "org"
  let suffix = 1
  const MAX_SLUG_ATTEMPTS = 20
  while (await db.organization.findUnique({ where: { slug } })) {
    if (suffix > MAX_SLUG_ATTEMPTS) throw new ServiceError("Could not generate a unique slug", "CONFLICT")
    slug = `${baseSlug || "org"}-${suffix++}`
  }

  const org = await db.$transaction(async (tx) => {
    // Prisma 7 types the tx callback param as Omit<PrismaClient, ITXClientDenyList>;
    // tsc cannot see delegate properties through Omit on a class, so cast as done
    // in app/api/me/account/route.ts.
    const client = tx as unknown as PrismaClient

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    const newOrg = await client.organization.create({
      data: {
        name: trimmedName, slug, currency: resolvedCurrency, trialEndsAt,
        ...(country  && { country }),
        ...(locale   && { locale }),
        ...(timezone && { timezone }),
        ...(industry && { industry }),
        ...(Object.keys(settings).length > 0 && { settings: settings as Prisma.InputJsonObject }),
      },
    })

    // Ensure the User row exists before the membership FK references it. With the
    // JWT strategy the caller's id comes straight from the token, so a session
    // whose User was deleted (or a token that predates the row) would otherwise
    // fail the membership insert with an opaque FK violation. Upsert by id is a
    // no-op when the user already exists.
    await client.user.upsert({
      where:  { id: userId },
      update: {},
      create: { id: userId, email: userEmail ?? null, name: userName ?? null },
    })

    await client.membership.create({
      data: { userId, organizationId: newOrg.id, role: "MANAGER" },
    })

    // Pass the org's locale so the starter roles are seeded in its language —
    // these names are persisted data, so getting it wrong here is permanent.
    await seedDefaultRoles(newOrg.id, client, industry, newOrg.locale)
    await seedDefaultShiftTemplates(newOrg.id, client)

    return newOrg
  })

  return serOrg(org)
}

export async function updateOrgCurrency(
  orgId: string,
  newCurrency: string,
  actorUserId: string,
): Promise<Organization> {
  const org = await db.organization.findFirst({
    where: { id: orgId },
    orderBy: { createdAt: "asc" },
  })
  if (!org) throw new ServiceError("Not found", "NOT_FOUND")
  if (org.currency === newCurrency) return serOrg(org)

  const oldCurrency = org.currency

  // Fetch all employees for this org so we can group by their base currency.
  // Select only the fields we need for the conversion computation.
  const employees = await db.employee.findMany({
    where: { organizationId: orgId },
    select: {
      id:               true,
      hourlyWage:       true,
      wageBaseAmount:   true,
      wageBaseCurrency: true,
    },
  })

  // Determine which distinct base currencies we need rates for.
  // Employees without a wageBaseCurrency are treated as if their base is the
  // org's old currency (legacy/fallback path — backfill applied below).
  const baseCurrencies = new Set<string>()
  for (const emp of employees) {
    const base = emp.wageBaseCurrency ?? oldCurrency
    if (base !== newCurrency) {
      baseCurrencies.add(base)
    }
  }

  // Fetch one FX rate per distinct (base → newCurrency) pair, in parallel.
  const rateMap = new Map<string, number>()
  if (baseCurrencies.size > 0) {
    const rateEntries = await Promise.all(
      Array.from(baseCurrencies).map(async (baseCurrency): Promise<[string, number]> => {
        // Same-currency case: rate is exactly 1, no HTTP call needed.
        if (baseCurrency === newCurrency) return [baseCurrency, 1]
        try {
          const res = await fetch(
            `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${newCurrency}`,
            { signal: AbortSignal.timeout(8000) },
          )
          if (!res.ok) throw new Error("rate fetch failed")
          const data = await res.json() as { rates: Record<string, number> }
          const rate = data.rates[newCurrency]
          if (!rate) throw new Error("rate not in response")
          return [baseCurrency, rate]
        } catch {
          throw new ServiceError(
            `Could not fetch exchange rate for ${baseCurrency} → ${newCurrency}. Try again.`,
            "UPSTREAM",
          )
        }
      }),
    )
    for (const [currency, rate] of rateEntries) {
      rateMap.set(currency, rate)
    }
  }

  // Build the per-employee wage updates inside a transaction.
  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: orgId }, data: { currency: newCurrency } })

    for (const emp of employees) {
      const hasBase = emp.wageBaseAmount != null && emp.wageBaseCurrency != null

      // Legacy fallback: if base fields are null, treat current hourlyWage as
      // the base in the old org currency and backfill the base columns now.
      const baseAmount   = hasBase ? (emp.wageBaseAmount as { toNumber(): number }).toNumber() : (emp.hourlyWage as { toNumber(): number }).toNumber()
      const baseCurrency = hasBase ? emp.wageBaseCurrency! : oldCurrency

      const rate = baseCurrency === newCurrency ? 1 : (rateMap.get(baseCurrency) ?? 1)
      const newWage = Math.round(baseAmount * rate * 100) / 100

      await tx.employee.update({
        where: { id: emp.id },
        data: {
          hourlyWage: newWage,
          // Backfill base columns for legacy rows that didn't have them.
          ...(!hasBase && {
            wageBaseAmount:   baseAmount,
            wageBaseCurrency: baseCurrency,
          }),
        },
      })
    }
  })

  recordAudit({
    orgId,
    actorUserId,
    action: "CURRENCY_CHANGED",
    before: { currency: oldCurrency },
    after:  { currency: newCurrency },
  })

  const updated = await db.organization.findFirst({ where: { id: orgId }, orderBy: { createdAt: "asc" } })
  return serOrg(updated!)
}

export interface UpdateOrgProfileInput {
  name?:       string
  country?:    string
  timezone?:   string
  locale?:     string
  industry?:   string
  timeFormat?: "12h" | "24h"
}

/**
 * Update an org's descriptive profile (name/country/locale/timezone/industry) and
 * the timeFormat display preference. Currency is handled separately by
 * updateOrgCurrency because it also runs FX conversion on existing wages. Used by
 * the onboarding "back" flow so returning to step 1 edits the org instead of
 * creating a duplicate. Changing industry here does NOT re-seed job roles.
 */
export async function updateOrgProfile(
  orgId: string,
  input: UpdateOrgProfileInput,
): Promise<Organization> {
  const data: Prisma.OrganizationUpdateInput = {}
  if (input.name     !== undefined) data.name     = input.name.trim()
  if (input.country  !== undefined) data.country  = input.country
  if (input.timezone !== undefined) data.timezone = input.timezone
  if (input.locale   !== undefined) data.locale   = input.locale
  if (input.industry !== undefined) data.industry = input.industry

  if (input.timeFormat !== undefined) {
    const org     = await db.organization.findUnique({ where: { id: orgId }, select: { settings: true } })
    const current = (org?.settings as OrgScheduleSettings) ?? {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.settings = { ...current, timeFormat: input.timeFormat } as any
  }

  const updated = await db.organization.update({ where: { id: orgId }, data })
  return serOrg(updated)
}

export type OrgSettingsPatch = {
  hours?:                    Array<{ isOpen: boolean; openTime: string; closeTime: string }>
  defaultScheduleView?:      "week" | "timeline"
  timeOffEnabled?:           boolean
  availabilityWindowWeeks?:  number
  timeFormat?:               "12h" | "24h"
  includeManagerInSchedule?: boolean
  fullTimeHours?:            number
  reducedFullTimeHours?:     number
  timelineBufferHours?:      number
}

export async function updateOrgSettings(
  orgId: string,
  patch: OrgSettingsPatch,
): Promise<OrgScheduleSettings> {
  const org     = await db.organization.findUnique({ where: { id: orgId }, select: { settings: true } })
  const current = (org?.settings as OrgScheduleSettings) ?? {}
  const merged: OrgScheduleSettings = { ...current }

  if (patch.hours                   !== undefined) merged.hours                   = patch.hours
  if (patch.defaultScheduleView     !== undefined) merged.defaultScheduleView     = patch.defaultScheduleView
  if (patch.timeOffEnabled          !== undefined) merged.timeOffEnabled          = patch.timeOffEnabled
  if (patch.availabilityWindowWeeks !== undefined) merged.availabilityWindowWeeks = patch.availabilityWindowWeeks
  if (patch.timeFormat              !== undefined) merged.timeFormat              = patch.timeFormat
  if (patch.includeManagerInSchedule !== undefined) merged.includeManagerInSchedule = patch.includeManagerInSchedule
  if (patch.fullTimeHours           !== undefined) merged.fullTimeHours           = patch.fullTimeHours
  if (patch.reducedFullTimeHours    !== undefined) merged.reducedFullTimeHours    = patch.reducedFullTimeHours
  if (patch.timelineBufferHours     !== undefined) merged.timelineBufferHours     = patch.timelineBufferHours

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.organization.update({ where: { id: orgId }, data: { settings: merged as any } })

  return merged
}

/**
 * Sync the manager's own Employee record with the "include me in the schedule"
 * setting. Enabling creates (or reactivates) a self-linked Employee so the
 * manager appears as a schedulable chip; disabling deactivates it, preserving
 * any shift history. Idempotent — safe to call on every settings save.
 */
export async function syncManagerEmployee(
  orgId: string,
  manager: { userId: string; email?: string | null; name?: string | null },
  enabled: boolean,
): Promise<void> {
  // The manager's self-record is the Employee linked to their user account.
  const existing = await db.employee.findFirst({
    where: { organizationId: orgId, userId: manager.userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, isActive: true },
  })

  if (!enabled) {
    // Soft-deactivate so past shifts and labor-cost history stay intact.
    if (existing && existing.isActive) {
      await db.employee.update({ where: { id: existing.id }, data: { isActive: false } })
    }
    return
  }

  if (existing) {
    if (!existing.isActive) {
      // Reactivating the manager's own record consumes a seat like any other.
      await db.$transaction(async (tx) => {
        await assertSeatAvailable(tx, orgId)
        await tx.employee.update({ where: { id: existing.id }, data: { isActive: true } })
      })
    }
    return
  }

  // No self-record yet — create one. Prefer a "Manager" role, else the first
  // role that exists, so the employee passes the job-role integrity check.
  const managerRole = await db.jobRole.findFirst({
    where: { organizationId: orgId, name: "Manager" },
    select: { name: true },
  })
  const anyRole = managerRole ?? await db.jobRole.findFirst({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
    select: { name: true },
  })
  const jobRole = anyRole?.name ?? "Manager"

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { currency: true } })

  // A manager may already exist as an employee by email (added before linking);
  // reuse that row and link it rather than creating a duplicate.
  const email = manager.email?.toLowerCase().trim()
  const byEmail = email
    ? await db.employee.findUnique({ where: { organizationId_email: { organizationId: orgId, email } }, select: { id: true, isActive: true } })
    : null

  if (byEmail) {
    await db.$transaction(async (tx) => {
      // Only a seat consumer if the row is currently inactive — linking an
      // already-active employee to the manager's account changes no headcount.
      if (!byEmail.isActive) await assertSeatAvailable(tx, orgId)
      await tx.employee.update({
        where: { id: byEmail.id },
        data:  { userId: manager.userId, isActive: true },
      })
    })
    return
  }

  await db.$transaction(async (tx) => {
    await assertSeatAvailable(tx, orgId)
    return tx.employee.create({
    data: {
      organizationId:   orgId,
      userId:           manager.userId,
      name:             manager.name?.trim() || email || "Manager",
      // Fall back to a synthetic address only if the manager somehow has no email
      // (email is NOT NULL-unique per org on Employee).
      email:            email || `manager+${manager.userId}@no-email.local`,
      phone:            null,
      jobRole,
      hourlyWage:       0,
      wageBaseAmount:   0,
      wageBaseCurrency: org?.currency ?? "EUR",
      employmentType:   "FULL_TIME",
      contractedHours:  0,
      notes:            null,
      // The manager already has account access, so no invite is needed.
      inviteToken:      crypto.randomUUID(),
      inviteExpiry:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    })
  })
}

// ── Org context for the current user ─────────────────────────────────────────

export type OrgContext = {
  org:            Organization
  jobRoles:       JobRole[]
  shiftTemplates: ShiftTemplate[]
  /**
   * Non-null when the org is locked out of paid features, mirroring the 402 the
   * API guard returns. Computed here — rather than left for the client to infer
   * from a failed request — because the failure it describes is otherwise
   * invisible: every data fetch just returns nothing, and the UI renders an
   * empty roster that reads as data loss.
   *
   * `/api/me/context` is deliberately NOT billing-gated, so this endpoint keeps
   * answering 200 for a blocked org and remains the one reliable way to learn
   * that billing is why the rest of the app is empty.
   */
  billing:        BillingBlock | null
}

/** Read the billing block straight off a loaded org row. */
function billingBlockFor(o: {
  subscriptionStatus: string
  trialEndsAt: Date | null
  pastDueSince: Date | null
}): BillingBlock | null {
  return canAccessOrg({
    status: o.subscriptionStatus as SubscriptionStatus,
    trialEndsAt: o.trialEndsAt,
    pastDueSince: o.pastDueSince,
  })
}

export async function getOrgContext(userId: string): Promise<OrgContext | null> {
  const membership = await db.membership.findFirst({
    where: { userId, role: "MANAGER" },
    include: {
      organization: {
        include: {
          jobRoles:       { orderBy: { name: "asc" } },
          shiftTemplates: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  })
  if (!membership) return null

  const { organization: o } = membership
  return {
    org:            serOrg(o),
    jobRoles:       o.jobRoles.map(serJobRole),
    shiftTemplates: o.shiftTemplates.map(serShiftTemplate),
    billing:        billingBlockFor(o),
  }
}

/**
 * Org context for an arbitrary restaurant by id, independent of membership.
 * Used by the super-admin "acting-as" switch — callers MUST authorize the caller
 * as super admin before using this (it performs no membership check).
 */
export async function getOrgContextById(orgId: string): Promise<OrgContext | null> {
  const o = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      jobRoles:       { orderBy: { name: "asc" } },
      shiftTemplates: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  })
  if (!o) return null
  return {
    org:            serOrg(o),
    jobRoles:       o.jobRoles.map(serJobRole),
    shiftTemplates: o.shiftTemplates.map(serShiftTemplate),
    billing:        billingBlockFor(o),
  }
}

export async function getOrgForUser(userId: string): Promise<Organization | null> {
  const membership = await db.membership.findFirst({
    where: { userId, role: "MANAGER" },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  })
  return membership ? serOrg(membership.organization) : null
}

// ── Team management ───────────────────────────────────────────────────────────

export type TeamMember = {
  userId:   string
  name:     string | null
  email:    string | null
  role:     string
  joinedAt: string
}

export async function listTeam(orgId: string): Promise<TeamMember[]> {
  const members = await db.membership.findMany({
    where: { organizationId: orgId, role: "MANAGER" },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { joinedAt: "asc" },
  })
  return members.map((m) => ({
    userId:   m.userId,
    name:     m.user.name,
    email:    m.user.email,
    role:     m.user.role,
    joinedAt: m.joinedAt.toISOString(),
  }))
}

export type AddedMember = Omit<TeamMember, "joinedAt">

export async function addTeamMember(
  orgId:        string,
  actingUserId: string,
  email:        string,
): Promise<AddedMember> {
  const target = await db.user.findUnique({ where: { email } })
  if (!target) throw new ServiceError("No account found with that email. Ask them to sign up first.", "NOT_FOUND")
  if (target.id === actingUserId) throw new ServiceError("You already have manager access.", "CONFLICT")

  await db.$transaction([
    db.membership.upsert({
      where:  { userId_organizationId: { userId: target.id, organizationId: orgId } },
      create: { userId: target.id, organizationId: orgId, role: "MANAGER" },
      update: { role: "MANAGER" },
    }),
    ...(target.role === "EMPLOYEE"
      ? [db.user.update({ where: { id: target.id }, data: { role: "MANAGER" } })]
      : []),
  ])

  return {
    userId: target.id,
    name:   target.name,
    email:  target.email,
    role:   target.role === "EMPLOYEE" ? "MANAGER" : target.role,
  }
}

export async function removeTeamMember(
  orgId:        string,
  actingUserId: string,
  targetUserId: string,
): Promise<void> {
  if (targetUserId === actingUserId) throw new ServiceError("You cannot remove your own access", "CONFLICT")

  const target = await db.user.findUnique({ where: { id: targetUserId } })
  if (!target) throw new ServiceError("User not found", "NOT_FOUND")
  if (target.role === "ADMIN") throw new ServiceError("Cannot remove an admin's access", "FORBIDDEN")

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
  })
  if (!membership) throw new ServiceError("User is not a member of this organisation", "NOT_FOUND")

  await db.$transaction([
    db.membership.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data:  { role: "EMPLOYEE" },
    }),
    db.user.update({ where: { id: targetUserId }, data: { role: "EMPLOYEE" } }),
  ])
}

// ── Job roles ─────────────────────────────────────────────────────────────────

export async function listRoles(orgId: string): Promise<JobRole[]> {
  const roles = await db.jobRole.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
  })
  return roles.map(serJobRole)
}

export async function createJobRole(orgId: string, name: string, color: string): Promise<JobRole> {
  const existing = await db.jobRole.findFirst({ where: { organizationId: orgId, name }, select: { id: true } })
  if (existing) throw new ServiceError("A role with this name already exists", "CONFLICT")
  const role = await db.jobRole.create({ data: { organizationId: orgId, name, color } })
  return serJobRole(role)
}

export async function deleteJobRole(orgId: string, roleId: string): Promise<void> {
  const role = await db.jobRole.findFirst({ where: { id: roleId, organizationId: orgId }, select: { id: true } })
  if (!role) throw new ServiceError("Not found", "NOT_FOUND")
  const roleName = (await db.jobRole.findUniqueOrThrow({ where: { id: roleId }, select: { name: true } })).name
  const inUse = await db.employee.count({ where: { organizationId: orgId, jobRole: roleName } })
  if (inUse > 0) throw new ServiceError(`This role is assigned to ${inUse} employee${inUse > 1 ? "s" : ""} — reassign them first`, "CONFLICT")
  await db.jobRole.delete({ where: { id: roleId } })
}

export async function updateJobRole(
  orgId: string,
  roleId: string,
  patch: { name?: string; color?: string },
): Promise<JobRole> {
  const existing = await db.jobRole.findFirst({
    where: { id: roleId, organizationId: orgId },
    select: { id: true, name: true },
  })
  if (!existing) throw new ServiceError("Job role not found", "NOT_FOUND")

  const nameChanged = patch.name !== undefined && patch.name !== existing.name
  const data: { name?: string; color?: string } = {}
  if (nameChanged) data.name = patch.name
  if (patch.color !== undefined) data.color = patch.color

  // Nothing to change (e.g. a no-op rename) — return the current record.
  if (Object.keys(data).length === 0) {
    return serJobRole(await db.jobRole.findUniqueOrThrow({ where: { id: roleId } }))
  }

  // The role NAME is denormalized onto employees/shifts/templates, so a rename
  // must cascade. Color lives only on the role, so a color-only change is a
  // plain update.
  if (nameChanged) {
    const [updated] = await db.$transaction([
      db.jobRole.update({ where: { id: roleId }, data }),
      db.employee.updateMany({ where: { organizationId: orgId, jobRole: existing.name }, data: { jobRole: patch.name! } }),
      db.shift.updateMany({ where: { organizationId: orgId, jobRole: existing.name }, data: { jobRole: patch.name! } }),
      db.shiftTemplate.updateMany({ where: { organizationId: orgId, jobRole: existing.name }, data: { jobRole: patch.name! } }),
    ])
    return serJobRole(updated)
  }

  const updated = await db.jobRole.update({ where: { id: roleId }, data })
  return serJobRole(updated)
}

// ── Shift templates ───────────────────────────────────────────────────────────

export async function listShiftTemplates(orgId: string): Promise<ShiftTemplate[]> {
  const templates = await db.shiftTemplate.findMany({
    where: { organizationId: orgId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
  return templates.map(serShiftTemplate)
}

export type CreateShiftTemplateInput = {
  name:          string
  startTime:     string
  endTime:       string
  breakMinutes?: number
  jobRole?:      string
  colorTag?:     string | null
}

export async function createShiftTemplate(
  orgId: string,
  input: CreateShiftTemplateInput,
): Promise<ShiftTemplate> {
  const [existing, count] = await Promise.all([
    db.shiftTemplate.findFirst({ where: { organizationId: orgId, name: input.name }, select: { id: true } }),
    db.shiftTemplate.count({ where: { organizationId: orgId } }),
  ])
  if (existing) throw new ServiceError("A shift type with this name already exists", "CONFLICT")

  const template = await db.shiftTemplate.create({
    data: {
      organizationId: orgId,
      name:           input.name,
      startTime:      input.startTime,
      endTime:        input.endTime,
      breakMinutes:   input.breakMinutes ?? 0,
      jobRole:        input.jobRole      ?? "",
      colorTag:       input.colorTag     ?? null,
      sortOrder:      count,
    },
  })
  return serShiftTemplate(template)
}

export async function deleteShiftTemplate(orgId: string, templateId: string): Promise<void> {
  const template = await db.shiftTemplate.findFirst({
    where: { id: templateId, organizationId: orgId },
    select: { id: true },
  })
  if (!template) throw new ServiceError("Not found", "NOT_FOUND")
  await db.shiftTemplate.delete({ where: { id: templateId } })
}
