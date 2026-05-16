"use client"

import { useState, useEffect } from "react"
import {
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  Briefcase,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getInitials } from "@/lib/utils"
import { formatCurrency, getCurrencySymbol } from "@/lib/orgSettings"
import { isEmploymentType } from "@/types"
import type { Employee, EmploymentType, JobRole } from "@/types"

interface EmployeeDetailSheetProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (updated: Partial<Employee>) => void
  jobRoles: JobRole[]
  initialMode?: "view" | "edit"
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatContractLabel(type: EmploymentType, contractedHours: number): string {
  if (type === "FULL_TIME") return "Full Time (40h/week)"
  if (type === "REDUCED_FULL_TIME") return "Reduced Full Time (32h/week)"
  return `Part Time (${contractedHours}h/week)`
}

// ── View mode ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
        <Icon className="size-3.5 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
        <div className="text-sm text-gray-800">{children}</div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function EmployeeDetailSheet({
  employee,
  open,
  onOpenChange,
  onUpdate,
  jobRoles,
  initialMode = "view",
}: EmployeeDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(initialMode === "edit")

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editJobRole, setEditJobRole] = useState("")
  const [editHourlyWage, setEditHourlyWage] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editEmploymentType, setEditEmploymentType] = useState<EmploymentType>("PART_TIME")
  const [editContractedHours, setEditContractedHours] = useState("0")

  // Sync form state when employee changes or edit mode opens
  useEffect(() => {
    if (employee) {
      setEditName(employee.name)
      setEditEmail(employee.email)
      setEditPhone(employee.phone ?? "")
      setEditJobRole(employee.jobRole)
      setEditHourlyWage(employee.hourlyWage.toString())
      setEditNotes(employee.notes ?? "")
      setEditEmploymentType(employee.employmentType)
      setEditContractedHours(employee.contractedHours.toString())
    }
  }, [employee])

  useEffect(() => {
    setIsEditing(initialMode === "edit")
  }, [open, initialMode])

  const handleSave = () => {
    if (!employee) return
    const updated: Partial<Employee> = {}

    if (editName.trim() !== employee.name) updated.name = editName.trim()
    if (editEmail.trim() !== employee.email) updated.email = editEmail.trim()
    const newPhone = editPhone.trim() || null
    if (newPhone !== employee.phone) updated.phone = newPhone
    if (editJobRole.trim() !== employee.jobRole) updated.jobRole = editJobRole.trim()
    const newWage = parseFloat(editHourlyWage)
    if (!isNaN(newWage) && newWage !== employee.hourlyWage) updated.hourlyWage = newWage
    const newNotes = editNotes.trim() || null
    if (newNotes !== employee.notes) updated.notes = newNotes
    if (editEmploymentType !== employee.employmentType) updated.employmentType = editEmploymentType
    const newContractedHours = parseInt(editContractedHours, 10) || 0
    if (newContractedHours !== employee.contractedHours) updated.contractedHours = newContractedHours

    if (Object.keys(updated).length > 0) {
      onUpdate(updated)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    if (employee) {
      setEditName(employee.name)
      setEditEmail(employee.email)
      setEditPhone(employee.phone ?? "")
      setEditJobRole(employee.jobRole)
      setEditHourlyWage(employee.hourlyWage.toString())
      setEditNotes(employee.notes ?? "")
      setEditEmploymentType(employee.employmentType)
      setEditContractedHours(employee.contractedHours.toString())
    }
    setIsEditing(false)
  }

  if (!employee) return null

  // TODO: fetch from /api/orgs/[orgId]/employees/[employeeId]/sick-days?month=current
  const sickDaysThisMonth: number = 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] overflow-y-auto p-0 flex flex-col gap-0"
        showCloseButton
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-lg font-semibold select-none">
              {getInitials(employee.name)}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <SheetTitle className="text-base font-semibold text-gray-900 leading-tight">
                {employee.name}
              </SheetTitle>
              <p className="text-sm text-gray-500 mt-0.5">{employee.jobRole}</p>
              <div className="mt-2">
                <Badge
                  variant={employee.isActive ? "default" : "secondary"}
                  className={
                    employee.isActive
                      ? "bg-green-100 text-green-700 border-green-200 text-xs"
                      : "text-gray-500 text-xs"
                  }
                >
                  {employee.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="shrink-0"
              >
                Edit
              </Button>
            )}
          </div>
        </SheetHeader>

        <Separator />

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-5">
          {isEditing ? (
            // ── Edit mode ────────────────────────────────────────────────────
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone (optional)</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="Not set"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Job Role</Label>
                <Select value={editJobRole} onValueChange={(val) => setEditJobRole(val ?? "")}>
                  <SelectTrigger id="edit-role" className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobRoles.map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-wage">Hourly Wage ({getCurrencySymbol()})</Label>
                <Input
                  id="edit-wage"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editHourlyWage}
                  onChange={(e) => setEditHourlyWage(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-employment-type">Employment Type</Label>
                <Select
                  value={editEmploymentType}
                  onValueChange={(val) => { if (val && isEmploymentType(val)) setEditEmploymentType(val) }}
                >
                  <SelectTrigger id="edit-employment-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full Time (40h/week)</SelectItem>
                    <SelectItem value="REDUCED_FULL_TIME">Reduced Full Time (32h/week)</SelectItem>
                    <SelectItem value="PART_TIME">Part Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editEmploymentType === "PART_TIME" && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-contracted-hours">Contracted Hours / week</Label>
                  <Input
                    id="edit-contracted-hours"
                    type="number"
                    min="0"
                    max="40"
                    value={editContractedHours}
                    onChange={(e) => setEditContractedHours(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="edit-notes">Notes (optional)</Label>
                <Textarea
                  id="edit-notes"
                  placeholder="Any notes about this employee..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          ) : (
            // ── View mode ────────────────────────────────────────────────────
            <div className="space-y-4">
              <InfoRow icon={Mail} label="Email">
                <a
                  href={`mailto:${employee.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {employee.email}
                </a>
              </InfoRow>

              <InfoRow icon={Phone} label="Phone">
                {employee.phone ? (
                  <span>{employee.phone}</span>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </InfoRow>

              <InfoRow icon={Briefcase} label="Hourly rate">
                <span>{formatCurrency(employee.hourlyWage)} / hour</span>
              </InfoRow>

              <InfoRow icon={Briefcase} label="Contract">
                <span>{formatContractLabel(employee.employmentType, employee.contractedHours)}</span>
              </InfoRow>

              <InfoRow icon={Calendar} label="Member since">
                <span>{formatDate(employee.createdAt)}</span>
              </InfoRow>

              {employee.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Notes
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {employee.notes}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Sick days */}
              <div className="flex items-center gap-2.5 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5">
                <AlertTriangle className="size-4 text-rose-400 shrink-0" />
                <p className="text-sm text-rose-700">
                  {/* TODO: fetch from /api/orgs/[orgId]/employees/[employeeId]/sick-days?month=current */}
                  <span className="font-medium">{sickDaysThisMonth}</span>{" "}
                  sick {sickDaysThisMonth === 1 ? "day" : "days"} this month
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer — only in edit mode */}
        {isEditing && (
          <>
            <Separator />
            <div className="px-6 py-4 flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save changes
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
