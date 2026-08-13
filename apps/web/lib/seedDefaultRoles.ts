import { db } from "@/lib/prisma"
import { PrismaClient } from "@/app/generated/prisma/client"
import { getMessages, DEFAULT_LOCALE, type Locale } from "@skemaka/i18n"
import { resolveRecipientLocale } from "@/lib/messages"

// Industry-neutral defaults so the product doesn't read as restaurant-only
// (a retail store or clinic would balk at "Server"/"Bartender"). Used when no
// industry is given. Users add their own roles during onboarding and in Settings.
export const DEFAULT_JOB_ROLES = [
  { name: "Staff",      color: "blue"   },
  { name: "Shift lead", color: "purple" },
  { name: "Manager",    color: "green"  },
]

// Starter role sets tailored to the industry picked during onboarding, so the
// first-run experience feels relevant. Falls back to the neutral set above.
// Keys must match the INDUSTRIES values in the onboarding page.
const ROLES_BY_INDUSTRY: Record<string, { name: string; color: string }[]> = {
  restaurant: [
    { name: "Server",    color: "blue"   },
    { name: "Bartender", color: "purple" },
    { name: "Kitchen",   color: "orange" },
    { name: "Host",      color: "yellow" },
    { name: "Manager",   color: "green"  },
  ],
  cafe: [
    { name: "Barista", color: "blue"   },
    { name: "Server",  color: "purple" },
    { name: "Kitchen", color: "orange" },
    { name: "Manager", color: "green"  },
  ],
  retail: [
    { name: "Sales associate", color: "blue"   },
    { name: "Cashier",         color: "yellow" },
    { name: "Stockroom",       color: "orange" },
    { name: "Shift lead",      color: "purple" },
    { name: "Manager",         color: "green"  },
  ],
  hospitality: [
    { name: "Front desk",   color: "blue"   },
    { name: "Housekeeping", color: "orange" },
    { name: "Concierge",    color: "purple" },
    { name: "Manager",      color: "green"  },
  ],
  healthcare: [
    { name: "Nurse",        color: "blue"   },
    { name: "Receptionist", color: "purple" },
    { name: "Assistant",    color: "orange" },
    { name: "Manager",      color: "green"  },
  ],
  salon: [
    { name: "Stylist",      color: "blue"   },
    { name: "Therapist",    color: "purple" },
    { name: "Receptionist", color: "yellow" },
    { name: "Manager",      color: "green"  },
  ],
  fitness: [
    { name: "Trainer",    color: "blue"   },
    { name: "Instructor", color: "purple" },
    { name: "Front desk", color: "yellow" },
    { name: "Manager",    color: "green"  },
  ],
  warehouse: [
    { name: "Picker",            color: "blue"   },
    { name: "Packer",            color: "yellow" },
    { name: "Forklift operator", color: "orange" },
    { name: "Shift lead",        color: "purple" },
    { name: "Manager",           color: "green"  },
  ],
  cleaning: [
    { name: "Cleaner",    color: "blue"   },
    { name: "Team lead",  color: "purple" },
    { name: "Supervisor", color: "orange" },
    { name: "Manager",    color: "green"  },
  ],
  childcare: [
    { name: "Educator",  color: "blue"   },
    { name: "Assistant", color: "orange" },
    { name: "Cook",      color: "yellow" },
    { name: "Manager",   color: "green"  },
  ],
  security: [
    { name: "Guard",       color: "blue"   },
    { name: "Supervisor",  color: "purple" },
    { name: "Dispatcher",  color: "orange" },
    { name: "Manager",     color: "green"  },
  ],
}

function rolesForIndustry(industry?: string) {
  return (industry && ROLES_BY_INDUSTRY[industry]) || DEFAULT_JOB_ROLES
}

// Generic, role-agnostic shift-type presets so a new restaurant's Shift Types
// section isn't empty on day one. Each is a per-org copy (like job roles), so
// deleting one only affects that restaurant. jobRole "" means "any role".
export const DEFAULT_SHIFT_TEMPLATES = [
  { name: "Morning",   startTime: "07:00", endTime: "15:00", breakMinutes: 30, sortOrder: 0 },
  { name: "Afternoon", startTime: "11:00", endTime: "19:00", breakMinutes: 30, sortOrder: 1 },
  { name: "Evening",   startTime: "15:00", endTime: "23:00", breakMinutes: 0,  sortOrder: 2 },
]

// Accepts an optional Prisma transaction client so it can be called inside a
// $transaction block. Falls back to the global db client when not in a transaction.
// `industry` (when given) selects an industry-specific starter role set.
/**
 * Translate a starter role name into the org's language.
 *
 * These names are written to the database as data, not rendered through a
 * component, so an untranslated seed is permanent: a Danish restaurant was
 * left with "Kitchen" and "Server" on its roster forever, and no amount of
 * UI translation afterwards could fix it. Unknown names pass through, which
 * is what happens to any role a user adds themselves.
 */
export function localizeRoleName(name: string, locale: Locale): string {
  // Read the catalog directly rather than through createTranslator: next-intl
  // types `t()` against the catalog and will not accept a runtime string key,
  // and these entries are plain strings with no ICU arguments anyway.
  const messages = getMessages(locale) as { common?: { jobRoles?: Record<string, string> } }
  return messages.common?.jobRoles?.[name] ?? name
}

export async function seedDefaultRoles(
  organizationId: string,
  client?: PrismaClient,
  industry?: string,
  /** Org locale ("da", "da-DK", …). Falls back to English when absent. */
  orgLocale?: string | null,
) {
  const c = client ?? db
  const locale = orgLocale ? resolveRecipientLocale(orgLocale) : DEFAULT_LOCALE
  await c.jobRole.createMany({
    skipDuplicates: true,
    data: rolesForIndustry(industry).map((r) => ({
      ...r,
      name: localizeRoleName(r.name, locale),
      organizationId,
    })),
  })
}

// Accepts an optional Prisma transaction client so it can run inside the org-
// creation transaction. skipDuplicates keeps it idempotent for backfills.
export async function seedDefaultShiftTemplates(
  organizationId: string,
  client?: PrismaClient,
) {
  const c = client ?? db
  await c.shiftTemplate.createMany({
    skipDuplicates: true,
    data: DEFAULT_SHIFT_TEMPLATES.map((t) => ({ ...t, jobRole: "", colorTag: null, organizationId })),
  })
}
