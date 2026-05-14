// Module-level store for employee state shared across manager pages.
// Mutations made in the employees page are visible to other pages after navigation.
// SAFE: only imported by "use client" files — never runs during SSR.
// TODO: replace with /api/organizations/[orgId]/employees calls.

import { MOCK_EMPLOYEES } from "@/lib/mockData"
import type { Employee } from "@/types"

let _employees: Employee[] = structuredClone(MOCK_EMPLOYEES)

export function getEmployees(): Employee[] {
  return _employees
}

export function mutateEmployees(updater: (prev: Employee[]) => Employee[]): void {
  _employees = updater(_employees)
}
