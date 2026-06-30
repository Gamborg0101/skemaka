import { db } from "@/lib/prisma"
import { PrismaClient } from "@/app/generated/prisma/client"

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
}

function rolesForIndustry(industry?: string) {
  return (industry && ROLES_BY_INDUSTRY[industry]) || DEFAULT_JOB_ROLES
}

// Accepts an optional Prisma transaction client so it can be called inside a
// $transaction block. Falls back to the global db client when not in a transaction.
// `industry` (when given) selects an industry-specific starter role set.
export async function seedDefaultRoles(
  organizationId: string,
  client?: PrismaClient,
  industry?: string,
) {
  const c = client ?? db
  await c.jobRole.createMany({
    skipDuplicates: true,
    data: rolesForIndustry(industry).map((r) => ({ ...r, organizationId })),
  })
}
