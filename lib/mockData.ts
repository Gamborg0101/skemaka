// Shared mock data used across manager pages until real API calls are wired up.
// TODO: replace with /api/organizations/[orgId]/roles and /api/employees

import type { Employee, JobRole } from "@/types"

const NOW = new Date().toISOString()

export const MOCK_JOB_ROLES: JobRole[] = [
  { id: "role-1", organizationId: "org-1", name: "Barista",    color: "blue",   createdAt: NOW, updatedAt: NOW },
  { id: "role-2", organizationId: "org-1", name: "Kitchen",    color: "orange", createdAt: NOW, updatedAt: NOW },
  { id: "role-3", organizationId: "org-1", name: "Supervisor", color: "purple", createdAt: NOW, updatedAt: NOW },
  { id: "role-4", organizationId: "org-1", name: "Server",     color: "yellow", createdAt: NOW, updatedAt: NOW },
  { id: "role-5", organizationId: "org-1", name: "Cashier",    color: "green",  createdAt: NOW, updatedAt: NOW },
]

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "emp-1", organizationId: "org-1", userId: null,
    name: "Sophie Andersen", email: "sophie@example.com", phone: "+45 20 12 34 56",
    jobRole: "Barista", hourlyWage: 15.5, employmentType: "FULL_TIME", contractedHours: 40,
    notes: null, isActive: true, inviteToken: null, inviteExpiry: null,
    createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "emp-2", organizationId: "org-1", userId: null,
    name: "Marcus Jensen", email: "marcus@example.com", phone: null,
    jobRole: "Server", hourlyWage: 14.0, employmentType: "PART_TIME", contractedHours: 20,
    notes: "Weekend availability only", isActive: true, inviteToken: null, inviteExpiry: null,
    createdAt: "2025-01-05T00:00:00Z", updatedAt: "2025-01-05T00:00:00Z",
  },
  {
    id: "emp-3", organizationId: "org-1", userId: null,
    name: "Lena Christoffersen", email: "lena@example.com", phone: "+45 31 23 45 67",
    jobRole: "Kitchen", hourlyWage: 16.0, employmentType: "REDUCED_FULL_TIME", contractedHours: 32,
    notes: null, isActive: true, inviteToken: null, inviteExpiry: null,
    createdAt: "2025-01-10T00:00:00Z", updatedAt: "2025-01-10T00:00:00Z",
  },
  {
    id: "emp-4", organizationId: "org-1", userId: null,
    name: "Tom Eriksen", email: "tom@example.com", phone: null,
    jobRole: "Barista", hourlyWage: 15.0, employmentType: "PART_TIME", contractedHours: 16,
    notes: null, isActive: false, inviteToken: null, inviteExpiry: null,
    createdAt: "2025-02-01T00:00:00Z", updatedAt: "2025-03-01T00:00:00Z",
  },
  {
    id: "emp-5", organizationId: "org-1", userId: null,
    name: "Anna Pedersen", email: "anna@example.com", phone: null,
    jobRole: "Server", hourlyWage: 14.5, employmentType: "PART_TIME", contractedHours: 20,
    notes: null, isActive: true, inviteToken: null, inviteExpiry: null,
    createdAt: "2025-02-15T00:00:00Z", updatedAt: "2025-02-15T00:00:00Z",
  },
  {
    id: "emp-6", organizationId: "org-1", userId: null,
    name: "Jonas Møller", email: "jonas@example.com", phone: null,
    jobRole: "Barista", hourlyWage: 15.0, employmentType: "PART_TIME", contractedHours: 16,
    notes: null, isActive: true, inviteToken: null, inviteExpiry: null,
    createdAt: "2025-03-01T00:00:00Z", updatedAt: "2025-03-01T00:00:00Z",
  },
]
