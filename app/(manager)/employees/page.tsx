"use client"

import { useState, useEffect } from "react"
import { UserPlus, Power, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { AddEmployeeDialog } from "@/components/manager/AddEmployeeDialog"
import { EmployeeDetailSheet } from "@/components/manager/EmployeeDetailSheet"
import { DeactivateEmployeeDialog } from "@/components/manager/DeactivateEmployeeDialog"
import { toast } from "sonner"
import type { Employee, EmploymentType } from "@/types"
import { useOrg } from "@/lib/orgContext"
import { formatCurrency } from "@/lib/orgSettings"

export default function EmployeesPage() {
  const { orgId, jobRoles } = useOrg()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"view" | "edit">("view")
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active")
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/employees`)
      .then((r) => r.json())
      .then((data: { data?: Employee[] }) => {
        if (data.data) setEmployees(data.data)
      })
      .catch(() => toast.error("Failed to load employees"))
      .finally(() => setLoading(false))
  }, [orgId])

  const handleAdd = async (data: {
    name: string; email: string; phone: string; jobRole: string
    hourlyWage: number; employmentType: EmploymentType; contractedHours: number; notes: string | null
  }) => {
    const r = await fetch(`/api/orgs/${orgId}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const res = await r.json() as { data?: Employee; error?: string }
    if (res.data) {
      setEmployees((prev) => [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success(`${data.name} added. Invite sent to ${data.email}.`)
    } else {
      toast.error(res.error ?? "Failed to add employee")
    }
  }

  const handleDeactivateConfirm = async (_deleteShifts: boolean) => {
    if (!deactivateTarget) return
    const r = await fetch(`/api/orgs/${orgId}/employees/${deactivateTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    })
    if (r.ok) {
      setEmployees((prev) => prev.map((e) => e.id === deactivateTarget.id ? { ...e, isActive: false } : e))
      toast.success(`${deactivateTarget.name} deactivated`)
      // TODO: delete future shifts when wired (_deleteShifts flag)
    } else {
      toast.error("Failed to deactivate employee")
    }
    setDeactivateTarget(null)
  }

  const handleReactivate = async (emp: Employee) => {
    const r = await fetch(`/api/orgs/${orgId}/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    if (r.ok) {
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, isActive: true } : e))
      toast.success(`${emp.name} reactivated`)
    } else {
      toast.error("Failed to reactivate employee")
    }
  }

  const handleRemove = async (empId: string, name: string) => {
    const r = await fetch(`/api/orgs/${orgId}/employees/${empId}`, { method: "DELETE" })
    if (r.ok) {
      setEmployees((prev) => prev.filter((e) => e.id !== empId))
      toast.success(`${name} removed`)
    } else {
      toast.error("Failed to remove employee")
    }
    setDeleteTarget(null)
  }

  const handleUpdate = async (empId: string, updated: Partial<Employee>) => {
    const r = await fetch(`/api/orgs/${orgId}/employees/${empId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    })
    const res = await r.json() as { data?: Employee; error?: string }
    if (res.data) {
      setEmployees((prev) => prev.map((e) => e.id === empId ? res.data! : e))
      setSelectedEmployee((prev) => prev?.id === empId ? res.data! : prev)
      toast.success("Employee updated")
    } else {
      toast.error(res.error ?? "Failed to update employee")
    }
  }

  const openSheet = (emp: Employee) => { setSelectedEmployee(emp); setSheetMode("view"); setSheetOpen(true) }
  const openSheetInEditMode = (emp: Employee) => { setSelectedEmployee(emp); setSheetMode("edit"); setSheetOpen(true) }

  const activeCount = employees.filter((e) => e.isActive).length
  const inactiveCount = employees.filter((e) => !e.isActive).length
  const visibleEmployees = employees.filter((e) => activeTab === "active" ? e.isActive : !e.isActive)

  return (
    <div className="px-4 md:px-6 py-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeCount} active · {inactiveCount} inactive</p>
        </div>
        {activeTab === "active" && (
          <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
            <UserPlus className="size-4" />
            Add Employee
          </Button>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["active", "inactive"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
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

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : visibleEmployees.length === 0 ? (
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
      ) : (
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
                  <TableCell className="hidden sm:table-cell text-gray-700 font-medium">{emp.jobRole}</TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-gray-700 font-medium">
                    {formatCurrency(emp.hourlyWage)}/hr
                  </TableCell>
                  <TableCell className="text-right">
                    {/* On mobile, tapping the row opens the sheet — action buttons shown on sm+ */}
                    <div className="hidden sm:flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openSheet(emp)} className="text-gray-500 hover:text-gray-700 text-xs">
                        View
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openSheetInEditMode(emp)} title="Edit" className="text-gray-500 hover:text-gray-700 min-w-[36px] min-h-[36px]">
                        <Pencil className="size-3.5" />
                      </Button>
                      {emp.isActive ? (
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeactivateTarget(emp)} title="Deactivate" className="text-gray-500 hover:text-amber-600 hover:bg-amber-50 min-w-[36px] min-h-[36px]">
                          <Power className="size-3.5" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon-sm" onClick={() => handleReactivate(emp)} title="Reactivate" className="text-green-600 hover:text-green-700 hover:bg-green-50 min-w-[36px] min-h-[36px]">
                          <Power className="size-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(emp)} className="text-red-500 hover:text-red-600 hover:bg-red-50 min-w-[36px] min-h-[36px]" title="Remove">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {/* Mobile: chevron indicator (row tap opens sheet) */}
                    <span className="sm:hidden text-gray-300 text-xs">›</span>
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
        jobRoles={jobRoles}
        onEmployeeAdd={handleAdd}
      />

      <EmployeeDetailSheet
        employee={selectedEmployee}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={(updated) => { if (selectedEmployee) handleUpdate(selectedEmployee.id, updated) }}
        jobRoles={jobRoles}
        orgId={orgId}
        initialMode={sheetMode}
      />

      {deactivateTarget && (
        <DeactivateEmployeeDialog
          open={!!deactivateTarget}
          onOpenChange={(v) => { if (!v) setDeactivateTarget(null) }}
          employee={deactivateTarget}
          upcomingShifts={[]}
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteTarget) handleRemove(deleteTarget.id, deleteTarget.name) }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
