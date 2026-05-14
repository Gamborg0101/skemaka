"use client"

import { useReducer, useState } from "react"
import { UserPlus, Power, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { AddEmployeeDialog } from "@/components/manager/AddEmployeeDialog"
import { EmployeeDetailSheet } from "@/components/manager/EmployeeDetailSheet"
import { DeactivateEmployeeDialog, type UpcomingShift } from "@/components/manager/DeactivateEmployeeDialog"
import { toast } from "sonner"
import type { Employee, EmploymentType } from "@/types"
import { MOCK_JOB_ROLES } from "@/lib/mockData"
import { getEmployees, mutateEmployees } from "@/lib/employeeStore"


// Upcoming shifts per employee (would come from /api/shifts?employeeId=...&from=today)
const UPCOMING_SHIFTS: Record<string, UpcomingShift[]> = {
  "emp-1": [
    { id: "s1-a", date: "2026-05-15", startTime: "08:00", endTime: "16:00", jobRole: "Barista" },
    { id: "s1-b", date: "2026-05-16", startTime: "09:00", endTime: "17:00", jobRole: "Barista" },
    { id: "s1-c", date: "2026-05-19", startTime: "08:00", endTime: "14:00", jobRole: "Barista" },
  ],
  "emp-2": [
    { id: "s2-a", date: "2026-05-17", startTime: "10:00", endTime: "18:00", jobRole: "Server" },
    { id: "s2-b", date: "2026-05-18", startTime: "11:00", endTime: "19:00", jobRole: "Server" },
  ],
  "emp-3": [
    { id: "s3-a", date: "2026-05-16", startTime: "07:00", endTime: "14:00", jobRole: "Kitchen" },
  ],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)

  const [addOpen, setAddOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"view" | "edit">("view")
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active")
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)

  const employees = getEmployees()

  function mutate(updater: (prev: Employee[]) => Employee[]) {
    mutateEmployees(updater)
    forceUpdate()
  }

  const handleAdd = (data: {
    name: string
    email: string
    phone: string | null
    jobRole: string
    hourlyWage: number
    employmentType: EmploymentType
    contractedHours: number
    notes: string | null
  }) => {
    const newEmp: Employee = {
      id: crypto.randomUUID(),
      organizationId: "org-1",
      userId: null,
      isActive: true,
      inviteToken: null,
      inviteExpiry: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    }
    mutate((prev) => [...prev, newEmp])
    toast.success(`${data.name} added. Invite sent to ${data.email}.`)
  }

  const handleDeactivateClick = (emp: Employee) => {
    setDeactivateTarget(emp)
  }

  const handleDeactivateConfirm = (deleteShifts: boolean) => {
    if (!deactivateTarget) return
    mutate((prev) =>
      prev.map((e) =>
        e.id === deactivateTarget.id ? { ...e, isActive: false } : e
      )
    )
    if (deleteShifts) {
      // TODO: DELETE /api/shifts?employeeId=...&from=today
      delete UPCOMING_SHIFTS[deactivateTarget.id]
    }
    toast.success(`${deactivateTarget.name} deactivated`)
    setDeactivateTarget(null)
  }

  const handleReactivate = (emp: Employee) => {
    mutate((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, isActive: true } : e))
    )
    toast.success(`${emp.name} reactivated`)
  }

  const handleRemove = (empId: string, name: string) => {
    mutate((prev) => prev.filter((e) => e.id !== empId))
    toast.success(`${name} removed`)
  }

  const handleUpdate = (empId: string, updated: Partial<Employee>) => {
    mutate((prev) => prev.map((e) => (e.id === empId ? { ...e, ...updated } : e)))
    setSelectedEmployee((prev) =>
      prev && prev.id === empId ? { ...prev, ...updated } : prev
    )
    toast.success("Employee updated")
  }

  const openSheet = (emp: Employee) => {
    setSelectedEmployee(emp)
    setSheetMode("view")
    setSheetOpen(true)
  }

  const openSheetInEditMode = (emp: Employee) => {
    setSelectedEmployee(emp)
    setSheetMode("edit")
    setSheetOpen(true)
  }

  const activeCount = employees.filter((e) => e.isActive).length
  const inactiveCount = employees.filter((e) => !e.isActive).length
  const visibleEmployees = employees.filter((e) =>
    activeTab === "active" ? e.isActive : !e.isActive
  )

  return (
    <div className="px-4 md:px-6 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        {activeTab === "active" && (
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <UserPlus className="size-4" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["active", "inactive"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
            {(tab === "active" ? activeCount : inactiveCount) > 0 && (
              <span className="ml-1.5 text-xs rounded-full bg-gray-100 text-gray-600 px-1.5 py-0.5 tabular-nums">
                {tab === "active" ? activeCount : inactiveCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {visibleEmployees.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          {activeTab === "active" ? (
            <>
              <p className="text-sm font-medium text-gray-500">No active employees</p>
              <p className="text-xs text-gray-400 mt-1">Add your first employee to get started.</p>
            </>
          ) : (
            <p className="text-sm font-medium text-gray-500">No inactive employees</p>
          )}
        </div>
      )}

      {/* Table */}
      {visibleEmployees.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-100 hover:bg-gray-100">
                <TableHead className="text-gray-700 font-semibold">Name</TableHead>
                <TableHead className="hidden sm:table-cell text-gray-700 font-semibold">Job Role</TableHead>
                <TableHead className="hidden md:table-cell text-right text-gray-700 font-semibold">Hourly Wage</TableHead>
                <TableHead className="text-right text-gray-700 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEmployees.map((emp, idx) => (
                <TableRow
                  key={emp.id}
                  className={`transition-colors cursor-pointer hover:bg-blue-50/40 ${idx % 2 === 1 ? "bg-gray-50" : "bg-white"}`}
                  onClick={() => openSheet(emp)}
                >
                  <TableCell>
                    <div>
                      <p className="font-semibold text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.phone ?? "—"}</p>
                      <p className="text-xs text-gray-500 sm:hidden">{emp.jobRole}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-gray-700 font-medium">
                    {emp.jobRole}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-gray-700 font-medium">
                    &euro;{emp.hourlyWage.toFixed(2)}/hr
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSheet(emp)}
                        className="text-gray-500 hover:text-gray-700 text-xs"
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openSheetInEditMode(emp)}
                        title="Edit employee"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {emp.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeactivateClick(emp)}
                          title="Deactivate"
                          className="text-gray-500 hover:text-amber-600 hover:bg-amber-50"
                        >
                          <Power className="size-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleReactivate(emp)}
                          title="Reactivate"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Power className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(emp)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Remove employee"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        jobRoles={MOCK_JOB_ROLES}
        onEmployeeAdd={handleAdd}
      />

      <EmployeeDetailSheet
        employee={selectedEmployee}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={(updated) => {
          if (selectedEmployee) handleUpdate(selectedEmployee.id, updated)
        }}
        jobRoles={MOCK_JOB_ROLES}
        initialMode={sheetMode}
      />

      {deactivateTarget && (
        <DeactivateEmployeeDialog
          open={!!deactivateTarget}
          onOpenChange={(v) => { if (!v) setDeactivateTarget(null) }}
          employee={deactivateTarget}
          upcomingShifts={UPCOMING_SHIFTS[deactivateTarget.id] ?? []}
          onConfirm={handleDeactivateConfirm}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove employee?</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-gray-900">{deleteTarget?.name}</span>{" "}
              from the system. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  handleRemove(deleteTarget.id, deleteTarget.name)
                  setDeleteTarget(null)
                }
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
