"use client"

import { useState, useEffect } from "react"
import { UserPlus, Power, Trash2, Pencil, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { fetchPage } from "@/lib/pagination"

const PAGE_SIZE = 25

export default function EmployeesPage() {
  const { orgId, jobRoles, org } = useOrg()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"view" | "edit">("view")
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active")
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [resendingInvite, setResendingInvite] = useState<string | null>(null)

  // Server-side pagination + per-tab counts.
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [inactiveCount, setInactiveCount] = useState(0)

  // Bumping this token re-runs the load effect (used by mutations to refresh).
  const [reloadToken, setReloadToken] = useState(0)
  const reload = () => setReloadToken((t) => t + 1)

  // Derive loading from whether the data matches the requested (tab, page) key,
  // rather than toggling a flag synchronously inside the effect.
  const [loadedKey, setLoadedKey] = useState("")
  const currentKey = `${orgId}|${activeTab}|${offset}`
  const loading = currentKey !== loadedKey

  const handleResendInvite = async (emp: Employee) => {
    setResendingInvite(emp.id)
    try {
      const r = await fetch(`/api/orgs/${orgId}/employees/${emp.id}/invite`, { method: "POST" })
      if (!r.ok) throw new Error()
      toast.success(`Invite resent to ${emp.email}`)
    } catch {
      toast.error("Failed to resend invite")
    } finally {
      setResendingInvite(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, meta } = await fetchPage<Employee>(
          `/api/orgs/${orgId}/employees?status=${activeTab}`,
          PAGE_SIZE,
          offset,
          { cache: "no-store" },
        )
        if (cancelled) return
        const m = meta as typeof meta & { activeCount: number; inactiveCount: number }
        setEmployees(data)
        setTotal(m.total)
        setActiveCount(m.activeCount)
        setInactiveCount(m.inactiveCount)
      } catch {
        if (!cancelled) toast.error("Failed to load employees")
      } finally {
        if (!cancelled) setLoadedKey(`${orgId}|${activeTab}|${offset}`)
      }
    })()
    return () => { cancelled = true }
  }, [orgId, activeTab, offset, reloadToken])

  // Switch tab: reset to the first page (the effect above reloads).
  const changeTab = (tab: "active" | "inactive") => {
    setActiveTab(tab)
    setOffset(0)
  }

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
      toast.success(`${data.name} added — invite email sent`)
      // New employees are active; surface them on the active tab's first page.
      if (activeTab === "active" && offset === 0) reload()
      else changeTab("active")
    } else {
      toast.error(res.error ?? "Failed to add employee")
    }
  }

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return
    const target = deactivateTarget
    setDeactivateTarget(null)
    const r = await fetch(`/api/orgs/${orgId}/employees/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    })
    if (!r.ok) { toast.error("Failed to deactivate employee"); return }
    toast.success(`${target.name} deactivated`)
    reload()
  }

  const handleReactivate = async (emp: Employee) => {
    const r = await fetch(`/api/orgs/${orgId}/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    if (!r.ok) { toast.error("Failed to reactivate employee"); return }
    toast.success(`${emp.name} reactivated`)
    reload()
  }

  const handleRemove = async (empId: string, name: string) => {
    setDeleteTarget(null)
    const r = await fetch(`/api/orgs/${orgId}/employees/${empId}`, { method: "DELETE" })
    if (!r.ok) { toast.error("Failed to remove employee"); return }
    toast.success(`${name} removed`)
    reload()
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

  // Counts come from the server (whole org); the page itself is the current tab.
  const visibleEmployees = employees

  return (
    <div className="flex flex-col h-full">
      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Employees</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{activeCount} active · {inactiveCount} inactive</p>
        </div>
        {activeTab === "active" && (
          <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
            <UserPlus className="size-4" />
            Add Employee
          </Button>
        )}
      </div>
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between gap-3 px-4 pt-6 pb-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Employees</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{activeCount} active · {inactiveCount} inactive</p>
        </div>
        {activeTab === "active" && (
          <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
            <UserPlus className="size-4" />
            Add Employee
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
        {(["active", "inactive"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => changeTab(tab)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              activeTab === tab ? "border-blue-600 text-blue-600 dark:border-gray-400 dark:text-slate-200" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab}
            {(tab === "active" ? activeCount : inactiveCount) > 0 && (
              <span className="ml-1.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 tabular-nums">
                {tab === "active" ? activeCount : inactiveCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left"><Skeleton className="h-4 w-16" /></th>
                <th className="hidden sm:table-cell px-4 py-3 text-left"><Skeleton className="h-4 w-16" /></th>
                <th className="hidden md:table-cell px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></th>
                <th className="px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className={`border-b border-gray-100 dark:border-gray-800 ${i % 2 === 1 ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"}`}>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-32 mb-1.5" />
                    <Skeleton className="h-3 w-24" />
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="hidden md:table-cell px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Skeleton className="h-8 w-12 hidden sm:block" />
                      <Skeleton className="h-8 w-8 hidden sm:block" />
                      <Skeleton className="h-8 w-8 hidden sm:block" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : visibleEmployees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          {activeTab === "active" ? (
            <>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No active employees</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add your first employee to get started.</p>
            </>
          ) : (
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No inactive employees</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
                <TableHead className="text-gray-700 dark:text-gray-300 font-semibold">Name</TableHead>
                <TableHead className="hidden sm:table-cell text-gray-700 dark:text-gray-300 font-semibold">Job Role</TableHead>
                <TableHead className="hidden md:table-cell text-right text-gray-700 dark:text-gray-300 font-semibold">Hourly Wage</TableHead>
                <TableHead className="text-right text-gray-700 dark:text-gray-300 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEmployees.map((emp, idx) => (
                <TableRow
                  key={emp.id}
                  className={`transition-colors cursor-pointer hover:bg-blue-50/40 dark:hover:bg-gray-700/30 ${idx % 2 === 1 ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"}`}
                  onClick={() => openSheet(emp)}
                >
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-gray-900 dark:text-gray-50">{emp.name}</p>
                        {emp.isActive && !emp.userId && (
                          <Tooltip content="Hasn't created their account yet — they won't get shift notifications until they do.">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 px-1.5 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              Not activated
                            </span>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{emp.phone ?? "—"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">{emp.jobRole}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-gray-700 dark:text-gray-300 font-medium">{emp.jobRole}</TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-gray-700 dark:text-gray-300 font-medium">
                    {formatCurrency(emp.hourlyWage, org?.currency)}/hr
                  </TableCell>
                  <TableCell className="text-right">
                    {/* On mobile, tapping the row opens the sheet — action buttons shown on sm+ */}
                    <div className="hidden sm:flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openSheet(emp)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs">
                        View
                      </Button>
                      <Tooltip content="Edit employee">
                        <Button variant="ghost" size="icon-sm" onClick={() => openSheetInEditMode(emp)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 min-w-[36px] min-h-[36px]">
                          <Pencil className="size-3.5" />
                        </Button>
                      </Tooltip>
                      {emp.isActive ? (
                        <Tooltip content="Deactivate employee">
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeactivateTarget(emp)} className="text-gray-500 hover:text-amber-600 hover:bg-amber-50 min-w-[36px] min-h-[36px]">
                            <Power className="size-3.5" />
                          </Button>
                        </Tooltip>
                      ) : (
                        <Tooltip content="Reactivate employee">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleReactivate(emp)} className="text-green-600 hover:text-green-700 hover:bg-green-50 min-w-[36px] min-h-[36px]">
                            <Power className="size-3.5" />
                          </Button>
                        </Tooltip>
                      )}
                      {!emp.userId && (
                        <Tooltip content="Resend invite email">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleResendInvite(emp)}
                            disabled={resendingInvite === emp.id}
                            className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 min-w-[36px] min-h-[36px]"
                          >
                            <MailCheck className="size-3.5" />
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip content="Remove employee">
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(emp)} className="text-red-500 hover:text-red-600 hover:bg-red-50 min-w-[36px] min-h-[36px]">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </Tooltip>
                    </div>
                    {/* Mobile: chevron indicator (row tap opens sheet) */}
                    <span className="sm:hidden text-gray-300 dark:text-gray-600 text-xs">›</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && total > 0 && (
        <Pagination
          total={total}
          limit={PAGE_SIZE}
          offset={offset}
          onOffsetChange={setOffset}
          label={activeTab}
        />
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
              <span className="font-medium text-gray-900 dark:text-gray-50">{deleteTarget?.name}</span>{" "}
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
    </div>
  )
}
