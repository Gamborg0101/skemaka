// TODO: fetch from /api/admin/organizations (ADMIN role required)

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminOrganizationView, SubscriptionStatus } from "@/types"

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ORGS: AdminOrganizationView[] = [
  {
    id: "org-1",
    name: "The Daily Grind",
    slug: "the-daily-grind",
    currency: "DKK",
    stripeCustomerId: "cus_abc123",
    stripeSubscriptionId: "sub_abc123",
    subscriptionStatus: "ACTIVE",
    employeeCount: 6,
    memberCount: 2,
    activeEmployeeCount: 6,
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-05-01T08:00:00Z",
  },
  {
    id: "org-2",
    name: "Brunch Club",
    slug: "brunch-club",
    currency: "DKK",
    stripeCustomerId: "cus_def456",
    stripeSubscriptionId: "sub_def456",
    subscriptionStatus: "TRIALING",
    employeeCount: 3,
    memberCount: 1,
    activeEmployeeCount: 3,
    createdAt: "2026-04-01T09:00:00Z",
    updatedAt: "2026-04-01T09:00:00Z",
  },
  {
    id: "org-3",
    name: "Harbor Kitchen",
    slug: "harbor-kitchen",
    currency: "DKK",
    stripeCustomerId: "cus_ghi789",
    stripeSubscriptionId: "sub_ghi789",
    subscriptionStatus: "PAST_DUE",
    employeeCount: 8,
    memberCount: 3,
    activeEmployeeCount: 7,
    createdAt: "2025-03-10T14:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  },
  {
    id: "org-4",
    name: "Corner Bakery",
    slug: "corner-bakery",
    currency: "DKK",
    stripeCustomerId: "cus_jkl012",
    stripeSubscriptionId: null,
    subscriptionStatus: "CANCELED",
    employeeCount: 4,
    memberCount: 1,
    activeEmployeeCount: 0,
    createdAt: "2025-06-01T11:00:00Z",
    updatedAt: "2025-12-01T11:00:00Z",
  },
  {
    id: "org-5",
    name: "Sunset Bistro",
    slug: "sunset-bistro",
    currency: "DKK",
    stripeCustomerId: "cus_mno345",
    stripeSubscriptionId: "sub_mno345",
    subscriptionStatus: "ACTIVE",
    employeeCount: 12,
    memberCount: 4,
    activeEmployeeCount: 11,
    createdAt: "2024-11-20T07:00:00Z",
    updatedAt: "2026-04-15T12:00:00Z",
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const config: Record<SubscriptionStatus, { label: string; className: string }> = {
    ACTIVE: { label: "Active", className: "bg-green-100 text-green-700 border-green-200" },
    TRIALING: { label: "Trialing", className: "bg-blue-100 text-blue-700 border-blue-200" },
    PAST_DUE: { label: "Past Due", className: "bg-amber-100 text-amber-700 border-amber-200" },
    CANCELED: { label: "Canceled", className: "bg-gray-100 text-gray-500" },
  }
  const { label, className } = config[status]
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const orgs = MOCK_ORGS

  const totalOrgs = orgs.length
  const totalActive = orgs.filter((o) => o.subscriptionStatus === "ACTIVE").length
  const totalEmployees = orgs.reduce((sum, o) => sum + o.activeEmployeeCount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Organizations</h1>
        <p className="text-sm text-gray-500 mt-0.5">All registered businesses</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Orgs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalOrgs}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Active Subs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalActive}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalEmployees}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {orgs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-gray-500">No organizations registered yet</p>
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-gray-400 font-mono text-xs">
                  {org.slug}
                </TableCell>
                <TableCell>
                  <StatusBadge status={org.subscriptionStatus} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {org.activeEmployeeCount}
                  {org.activeEmployeeCount !== org.employeeCount && (
                    <span className="text-gray-400"> / {org.employeeCount}</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-gray-500">
                  {org.memberCount}
                </TableCell>
                <TableCell className="text-gray-500 text-xs">
                  {formatDate(org.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  )
}
